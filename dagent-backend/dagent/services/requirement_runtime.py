from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
from contextlib import suppress
from copy import deepcopy
from typing import Any

from sqlalchemy import select

from dagent.config import Settings
from dagent.db.session import async_session
from dagent.models import Requirement, RequirementWorkspace
from dagent.pipeline.state_machine import PipelineState, RunStatus

logger = logging.getLogger(__name__)

AGENT_ROLE_PORTS = {
    "requirement_clarification": 4096,
    "development_document": 4097,
    "development": 4098,
}

AGENT_ROLE_SECRET_SCOPES = {
    role: f"opencode:{role}" for role in AGENT_ROLE_PORTS
}


def requirement_runtime_secret_value(
    settings: Settings,
    requirement_id: int,
    scope: str,
) -> str:
    master_key = settings.GIT_CREDENTIAL_ENCRYPTION_KEY or settings.AGENT_CALLBACK_TOKEN
    return hmac.new(
        master_key.encode(),
        f"dagent:{scope}:{requirement_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def requirement_runtime_name(requirement_id: int) -> str:
    return f"dagent-requirement-{requirement_id}"


def requirement_workspace_claim_name(requirement_id: int) -> str:
    return f"{requirement_runtime_name(requirement_id)}-workspace"


def requirement_runtime_url(settings: Settings, requirement_id: int, port: int) -> str:
    base = settings.REQUIREMENT_RUNTIME_SERVICE_TEMPLATE.format(
        requirement_id=requirement_id
    ).rstrip("/")
    return f"{base}:{port}"


def _labels(requirement_id: int, tenant_id: int) -> dict[str, str]:
    return {
        "app.kubernetes.io/name": "dagent-requirement-runtime",
        "app.kubernetes.io/part-of": "dagent",
        "dagent/requirement-id": str(requirement_id),
        "dagent/tenant-id": str(tenant_id),
    }


def build_workspace_claim(
    settings: Settings,
    requirement_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    spec: dict[str, Any] = {
        "accessModes": ["ReadWriteOnce"],
        "resources": {
            "requests": {"storage": settings.REQUIREMENT_RUNTIME_STORAGE_SIZE}
        },
    }
    if settings.REQUIREMENT_RUNTIME_STORAGE_CLASS:
        spec["storageClassName"] = settings.REQUIREMENT_RUNTIME_STORAGE_CLASS
    return {
        "apiVersion": "v1",
        "kind": "PersistentVolumeClaim",
        "metadata": {
            "name": requirement_workspace_claim_name(requirement_id),
            "namespace": settings.REQUIREMENT_RUNTIME_NAMESPACE,
            "labels": _labels(requirement_id, tenant_id),
        },
        "spec": spec,
    }


def build_runtime_service(
    settings: Settings,
    requirement_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    labels = _labels(requirement_id, tenant_id)
    return {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": requirement_runtime_name(requirement_id),
            "namespace": settings.REQUIREMENT_RUNTIME_NAMESPACE,
            "labels": labels,
        },
        "spec": {
            "selector": labels,
            "ports": [
                {
                    "name": "clarification",
                    "port": AGENT_ROLE_PORTS["requirement_clarification"],
                    "targetPort": "clarification",
                },
                {
                    "name": "dev-document",
                    "port": AGENT_ROLE_PORTS["development_document"],
                    "targetPort": "dev-document",
                },
                {
                    "name": "development",
                    "port": AGENT_ROLE_PORTS["development"],
                    "targetPort": "development",
                },
                {"name": "workspace", "port": 8090, "targetPort": "workspace"},
            ],
        },
    }


def _build_agent_container(
    *,
    name: str,
    image: str,
    port_name: str,
    port: int,
    password_file: str,
    state_directory: str,
    workspace_read_only: bool,
    cpu_request: str,
    memory_request: str,
    cpu_limit: str,
    memory_limit: str,
    requirement_id: int,
) -> dict[str, Any]:
    return {
        "name": name,
        "image": image,
        "imagePullPolicy": "IfNotPresent",
        "command": [
            "sh",
            "-c",
            "exec env OPENCODE_SERVER_PASSWORD=\"$(cat /run/dagent/opencode-password)\" "
            f"opencode serve --hostname 0.0.0.0 --port {port}",
        ],
        "envFrom": [{"secretRef": {"name": "dagent-agent-callback"}}],
        "env": [
            {"name": "DAGENT_REQUIREMENT_ID", "value": str(requirement_id)},
            {"name": "OPENCODE_SERVER_USERNAME", "value": "opencode"},
            {
                "name": "PATH",
                "value": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            },
            {
                "name": "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH",
                "value": "/usr/bin/chromium-browser",
            },
            {"name": "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "value": "1"},
            {"name": "SERENA_USAGE_REPORTING", "value": "false"},
        ],
        "ports": [{"name": port_name, "containerPort": port}],
        "startupProbe": {
            "tcpSocket": {"port": port_name},
            "failureThreshold": 60,
            "periodSeconds": 5,
        },
        "readinessProbe": {
            "tcpSocket": {"port": port_name},
            "periodSeconds": 10,
        },
        "livenessProbe": {
            "tcpSocket": {"port": port_name},
            "initialDelaySeconds": 30,
            "periodSeconds": 20,
        },
        "resources": {
            "requests": {"cpu": cpu_request, "memory": memory_request},
            "limits": {"cpu": cpu_limit, "memory": memory_limit},
        },
        "securityContext": {
            "allowPrivilegeEscalation": False,
            "capabilities": {"drop": ["ALL"]},
        },
        "volumeMounts": [
            {
                "name": "runtime-auth",
                "mountPath": "/run/dagent/opencode-password",
                "subPath": password_file,
                "readOnly": True,
            },
            {
                "name": "workspace",
                "mountPath": "/home/opencode/.local/share/opencode",
                "subPath": state_directory,
            },
            {
                "name": "workspace",
                "mountPath": "/workspaces",
                "subPath": "workspaces",
                "readOnly": workspace_read_only,
            },
        ],
    }


def build_runtime_deployment(
    settings: Settings,
    requirement_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    name = requirement_runtime_name(requirement_id)
    labels = _labels(requirement_id, tenant_id)
    pod_spec: dict[str, Any] = {
        "automountServiceAccountToken": False,
        "imagePullSecrets": [
            {"name": settings.REQUIREMENT_RUNTIME_IMAGE_PULL_SECRET}
        ],
        "securityContext": {
            "runAsUser": 1500,
            "runAsGroup": 1500,
            "fsGroup": 1500,
            "fsGroupChangePolicy": "OnRootMismatch",
        },
        "initContainers": [
            {
                "name": "initialize-requirement-runtime",
                "image": settings.REQUIREMENT_RUNTIME_INIT_IMAGE,
                "imagePullPolicy": "IfNotPresent",
                "command": [
                    "sh",
                    "-c",
                    " && ".join(
                        (
                            "mkdir -p /runtime-auth /data/state/requirement-clarification "
                            "/data/state/development-document /data/state/development /data/workspaces",
                            "node /opt/dagent/derive-runtime-auth.mjs /runtime-auth",
                            "test -s /runtime-auth/requirement-clarification-password",
                            "test -s /runtime-auth/development-document-password",
                            "test -s /runtime-auth/development-password",
                            "test -s /runtime-auth/workspace-token",
                            "chown -R 1500:1500 /runtime-auth /data",
                        )
                    ),
                ],
                "env": [
                    {"name": "DAGENT_REQUIREMENT_ID", "value": str(requirement_id)},
                    {
                        "name": "GIT_CREDENTIAL_ENCRYPTION_KEY",
                        "valueFrom": {
                            "secretKeyRef": {
                                "name": "dagent-git-credential-key",
                                "key": "GIT_CREDENTIAL_ENCRYPTION_KEY",
                            }
                        },
                    },
                ],
                "securityContext": {"runAsUser": 0, "runAsGroup": 0},
                "volumeMounts": [
                    {"name": "runtime-tools", "mountPath": "/opt/dagent", "readOnly": True},
                    {"name": "runtime-auth", "mountPath": "/runtime-auth"},
                    {"name": "workspace", "mountPath": "/data"},
                ],
            }
        ],
        "containers": [
            _build_agent_container(
                name="requirement-clarification",
                image=settings.REQUIREMENT_CLARIFICATION_IMAGE,
                port_name="clarification",
                port=AGENT_ROLE_PORTS["requirement_clarification"],
                password_file="requirement-clarification-password",
                state_directory="state/requirement-clarification",
                workspace_read_only=True,
                cpu_request="50m",
                memory_request="128Mi",
                cpu_limit="1",
                memory_limit="1Gi",
                requirement_id=requirement_id,
            ),
            _build_agent_container(
                name="development-document",
                image=settings.DEVELOPMENT_DOCUMENT_IMAGE,
                port_name="dev-document",
                port=AGENT_ROLE_PORTS["development_document"],
                password_file="development-document-password",
                state_directory="state/development-document",
                workspace_read_only=True,
                cpu_request="50m",
                memory_request="128Mi",
                cpu_limit="1",
                memory_limit="1Gi",
                requirement_id=requirement_id,
            ),
            _build_agent_container(
                name="development",
                image=settings.DEVELOPMENT_AGENT_IMAGE,
                port_name="development",
                port=AGENT_ROLE_PORTS["development"],
                password_file="development-password",
                state_directory="state/development",
                workspace_read_only=False,
                cpu_request="150m",
                memory_request="256Mi",
                cpu_limit="2",
                memory_limit="2Gi",
                requirement_id=requirement_id,
            ),
            {
                "name": "workspace-manager",
                "image": settings.REQUIREMENT_RUNTIME_INIT_IMAGE,
                "imagePullPolicy": "IfNotPresent",
                "command": [
                    "sh",
                    "-c",
                    "exec env WORKSPACE_MANAGER_TOKEN=\"$(cat /run/dagent/workspace-token)\" "
                    "node /opt/dagent/workspace-manager.mjs",
                ],
                "envFrom": [
                    {"secretRef": {"name": "dagent-agent-callback"}},
                ],
                "env": [
                    {"name": "DAGENT_REQUIREMENT_ID", "value": str(requirement_id)},
                    {"name": "WORKSPACE_ROOT", "value": "/workspaces"},
                    {"name": "WORKSPACE_MANAGER_PORT", "value": "8090"},
                ],
                "ports": [{"name": "workspace", "containerPort": 8090}],
                "startupProbe": {
                    "httpGet": {"path": "/health", "port": "workspace"},
                    "failureThreshold": 60,
                    "periodSeconds": 5,
                },
                "readinessProbe": {
                    "httpGet": {"path": "/health", "port": "workspace"},
                    "periodSeconds": 10,
                },
                "livenessProbe": {
                    "httpGet": {"path": "/health", "port": "workspace"},
                    "initialDelaySeconds": 30,
                    "periodSeconds": 20,
                },
                "resources": {
                    "requests": {"cpu": "50m", "memory": "64Mi"},
                    "limits": {"cpu": "500m", "memory": "256Mi"},
                },
                "securityContext": {
                    "allowPrivilegeEscalation": False,
                    "capabilities": {"drop": ["ALL"]},
                },
                "volumeMounts": [
                    {"name": "runtime-tools", "mountPath": "/opt/dagent", "readOnly": True},
                    {
                        "name": "runtime-auth",
                        "mountPath": "/run/dagent/workspace-token",
                        "subPath": "workspace-token",
                        "readOnly": True,
                    },
                    {
                        "name": "workspace",
                        "mountPath": "/workspaces",
                        "subPath": "workspaces",
                    },
                ],
            },
        ],
        "volumes": [
            {"name": "runtime-auth", "emptyDir": {}},
            {
                "name": "workspace",
                "persistentVolumeClaim": {
                    "claimName": requirement_workspace_claim_name(requirement_id)
                },
            },
            {
                "name": "runtime-tools",
                "configMap": {"name": "dagent-workspace-manager", "defaultMode": 0o555},
            },
        ],
    }
    if settings.REQUIREMENT_RUNTIME_NODE_NAME:
        pod_spec["nodeSelector"] = {
            "kubernetes.io/hostname": settings.REQUIREMENT_RUNTIME_NODE_NAME
        }
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": name,
            "namespace": settings.REQUIREMENT_RUNTIME_NAMESPACE,
            "labels": labels,
        },
        "spec": {
            "replicas": 1,
            "strategy": {"type": "Recreate"},
            "selector": {"matchLabels": labels},
            "template": {"metadata": {"labels": labels}, "spec": pod_spec},
        },
    }


def build_runtime_deployment_patch(
    settings: Settings,
    requirement_id: int,
    tenant_id: int,
) -> dict[str, Any]:
    deployment = deepcopy(
        build_runtime_deployment(settings, requirement_id, tenant_id)
    )
    pod_spec = deployment["spec"]["template"]["spec"]
    for field in ("initContainers", "containers", "volumes"):
        pod_spec[field] = [{"$patch": "replace"}, *pod_spec[field]]
    return deployment


class RequirementRuntimeOrchestrator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._runner: asyncio.Task[None] | None = None
        self._stopping = asyncio.Event()

    async def start(self) -> None:
        if not self.settings.REQUIREMENT_RUNTIME_ENABLED or self._runner is not None:
            return
        self._stopping.clear()
        self._runner = asyncio.create_task(
            self._run_reconciler(), name="dagent-requirement-runtime-reconciler"
        )

    async def stop(self) -> None:
        self._stopping.set()
        if self._runner is None:
            return
        self._runner.cancel()
        with suppress(asyncio.CancelledError):
            await self._runner
        self._runner = None

    async def ensure_requirement(self, requirement_id: int, tenant_id: int) -> bool:
        if not self.settings.REQUIREMENT_RUNTIME_ENABLED:
            return False
        await asyncio.to_thread(self._ensure_sync, requirement_id, tenant_id)
        return True

    async def remove_requirement(
        self,
        requirement_id: int,
        *,
        delete_workspace: bool,
    ) -> bool:
        if not self.settings.REQUIREMENT_RUNTIME_ENABLED:
            return False
        await asyncio.to_thread(self._remove_sync, requirement_id, delete_workspace)
        if delete_workspace:
            async with async_session() as session:
                workspaces = list(
                    (
                        await session.scalars(
                            select(RequirementWorkspace).where(
                                RequirementWorkspace.requirement_id == requirement_id
                            )
                        )
                    ).all()
                )
                for workspace in workspaces:
                    workspace.status = "deleted"
                    workspace.last_error = "Workspace PVC deleted by retention policy"
                    workspace.version += 1
                await session.commit()
        return True

    async def reconcile_once(self) -> None:
        if not self.settings.REQUIREMENT_RUNTIME_ENABLED:
            return
        async with async_session() as session:
            requirements = list((await session.scalars(select(Requirement))).all())
        for requirement in requirements:
            terminal = (
                requirement.deleted_at is not None
                or requirement.stage == PipelineState.COMPLETED.value
                or requirement.run_status == RunStatus.CANCELLED.value
            )
            try:
                if terminal:
                    await self.remove_requirement(
                        requirement.id,
                        delete_workspace=(requirement.workspace_retention_policy == "delete"),
                    )
                else:
                    await self.ensure_requirement(requirement.id, requirement.tenant_id)
            except Exception:  # noqa: BLE001
                logger.exception(
                    "failed to reconcile Agent runtime for requirement %s",
                    requirement.id,
                )

    async def _run_reconciler(self) -> None:
        while not self._stopping.is_set():
            try:
                await self.reconcile_once()
            except Exception:  # noqa: BLE001
                logger.exception("requirement runtime reconciliation failed")
            try:
                await asyncio.wait_for(
                    self._stopping.wait(),
                    timeout=self.settings.REQUIREMENT_RUNTIME_RECONCILE_SECONDS,
                )
            except TimeoutError:
                continue

    def _clients(self):
        from kubernetes import client, config

        config.load_incluster_config()
        return client, client.AppsV1Api(), client.CoreV1Api()

    @staticmethod
    def _missing(exc: Exception) -> bool:
        return getattr(exc, "status", None) == 404

    def _ensure_sync(self, requirement_id: int, tenant_id: int) -> None:
        _, apps, core = self._clients()
        namespace = self.settings.REQUIREMENT_RUNTIME_NAMESPACE
        name = requirement_runtime_name(requirement_id)
        claim_name = requirement_workspace_claim_name(requirement_id)
        try:
            core.read_namespaced_persistent_volume_claim(claim_name, namespace)
        except Exception as exc:  # noqa: BLE001
            if not self._missing(exc):
                raise
            core.create_namespaced_persistent_volume_claim(
                namespace,
                build_workspace_claim(self.settings, requirement_id, tenant_id),
            )
        service = build_runtime_service(self.settings, requirement_id, tenant_id)
        try:
            core.read_namespaced_service(name, namespace)
        except Exception as exc:  # noqa: BLE001
            if not self._missing(exc):
                raise
            core.create_namespaced_service(namespace, service)
        else:
            core.patch_namespaced_service(name, namespace, service)
        deployment = build_runtime_deployment(self.settings, requirement_id, tenant_id)
        try:
            apps.read_namespaced_deployment(name, namespace)
        except Exception as exc:  # noqa: BLE001
            if not self._missing(exc):
                raise
            apps.create_namespaced_deployment(namespace, deployment)
        else:
            apps.patch_namespaced_deployment(
                name,
                namespace,
                build_runtime_deployment_patch(
                    self.settings,
                    requirement_id,
                    tenant_id,
                ),
            )

    def _remove_sync(self, requirement_id: int, delete_workspace: bool) -> None:
        _, apps, core = self._clients()
        namespace = self.settings.REQUIREMENT_RUNTIME_NAMESPACE
        name = requirement_runtime_name(requirement_id)
        for delete_call in (
            lambda: apps.delete_namespaced_deployment(
                name, namespace, propagation_policy="Foreground"
            ),
            lambda: core.delete_namespaced_service(name, namespace),
        ):
            try:
                delete_call()
            except Exception as exc:  # noqa: BLE001
                if not self._missing(exc):
                    raise
        if delete_workspace:
            claim_name = requirement_workspace_claim_name(requirement_id)
            try:
                core.delete_namespaced_persistent_volume_claim(claim_name, namespace)
            except Exception as exc:  # noqa: BLE001
                if not self._missing(exc):
                    raise
