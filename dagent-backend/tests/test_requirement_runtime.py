import json
from pathlib import Path

from dagent.config import get_settings
from dagent.services.agent_runtime import AgentRuntime
from dagent.services.requirement_runtime import (
    AGENT_ROLE_PORTS,
    build_runtime_deployment,
    build_runtime_deployment_patch,
    build_runtime_service,
    build_workspace_claim,
    requirement_runtime_name,
    requirement_runtime_secret_value,
    requirement_runtime_url,
    requirement_workspace_claim_name,
)


def runtime_settings():
    return get_settings().model_copy(
        update={
            "REQUIREMENT_RUNTIME_ENABLED": True,
            "REQUIREMENT_RUNTIME_NAMESPACE": "dagent",
            "REQUIREMENT_CLARIFICATION_IMAGE": "registry.example/clarification:v1",
            "DEVELOPMENT_DOCUMENT_IMAGE": "registry.example/development-document:v1",
            "DEVELOPMENT_AGENT_IMAGE": "registry.example/development:v1",
            "WORKSPACE_MANAGER_IMAGE": "registry.example/workspace-manager:v1",
            "REQUIREMENT_RUNTIME_STORAGE_CLASS": "test-storage",
            "REQUIREMENT_RUNTIME_STORAGE_SIZE": "8Gi",
            "REQUIREMENT_RUNTIME_NODE_NAME": "worker-a",
        }
    )


def test_requirement_runtime_resources_are_isolated_by_requirement():
    settings = runtime_settings()
    deployment = build_runtime_deployment(settings, requirement_id=101, tenant_id=7)
    service = build_runtime_service(settings, requirement_id=101, tenant_id=7)
    claim = build_workspace_claim(settings, requirement_id=101, tenant_id=7)

    assert requirement_runtime_name(101) == "dagent-requirement-101"
    assert requirement_workspace_claim_name(101) == "dagent-requirement-101-workspace"
    assert deployment["spec"]["replicas"] == 1
    assert deployment["spec"]["strategy"] == {"type": "Recreate"}
    assert deployment["spec"]["selector"]["matchLabels"]["dagent/requirement-id"] == "101"

    pod = deployment["spec"]["template"]["spec"]
    assert pod["automountServiceAccountToken"] is False
    assert pod["nodeSelector"] == {"kubernetes.io/hostname": "worker-a"}
    assert pod["initContainers"][0]["image"] == settings.WORKSPACE_MANAGER_IMAGE
    init_command = pod["initContainers"][0]["command"][2]
    assert "tar -xzf" not in init_command
    assert "node /opt/dagent/derive-runtime-auth.mjs" in init_command
    for credential_file in (
        "requirement-clarification-password",
        "development-document-password",
        "development-password",
        "workspace-token",
    ):
        assert credential_file in init_command
    init_env = {item["name"]: item for item in pod["initContainers"][0]["env"]}
    assert init_env["GIT_CREDENTIAL_ENCRYPTION_KEY"]["valueFrom"]["secretKeyRef"] == {
        "name": "dagent-git-credential-key",
        "key": "GIT_CREDENTIAL_ENCRYPTION_KEY",
    }
    assert "agent-bundle" not in {volume["name"] for volume in pod["volumes"]}
    assert "runtime-tools" not in {volume["name"] for volume in pod["volumes"]}
    assert next(volume for volume in pod["volumes"] if volume["name"] == "workspace")[
        "persistentVolumeClaim"
    ]["claimName"] == "dagent-requirement-101-workspace"
    assert {container["name"] for container in pod["containers"]} == {
        "requirement-clarification",
        "development-document",
        "development",
        "workspace-manager",
    }
    containers = {container["name"]: container for container in pod["containers"]}
    assert containers["requirement-clarification"]["image"] == settings.REQUIREMENT_CLARIFICATION_IMAGE
    assert containers["development-document"]["image"] == settings.DEVELOPMENT_DOCUMENT_IMAGE
    assert containers["development"]["image"] == settings.DEVELOPMENT_AGENT_IMAGE
    assert containers["workspace-manager"]["image"] == settings.WORKSPACE_MANAGER_IMAGE
    expected_agents = {
        "requirement-clarification": (
            "requirement-clarification-password",
            "state/requirement-clarification",
            True,
            4096,
            "50m",
            "128Mi",
        ),
        "development-document": (
            "development-document-password",
            "state/development-document",
            True,
            4097,
            "50m",
            "128Mi",
        ),
        "development": (
            "development-password",
            "state/development",
            False,
            4098,
            "150m",
            "256Mi",
        ),
    }
    for name, (
        password_file,
        state_directory,
        read_only,
        port,
        cpu_request,
        memory_request,
    ) in expected_agents.items():
        container = containers[name]
        assert f"--port {port}" in container["command"][2]
        assert "/run/dagent/opencode-password" in container["command"][2]
        mounts = {mount["mountPath"]: mount for mount in container["volumeMounts"]}
        assert mounts["/run/dagent/opencode-password"]["subPath"] == password_file
        assert mounts["/home/opencode/.local/share/opencode"]["subPath"] == state_directory
        assert mounts["/workspaces"]["readOnly"] is read_only
        assert "/home/opencode/.config/opencode" not in mounts
        assert container["resources"]["requests"] == {
            "cpu": cpu_request,
            "memory": memory_request,
        }
    assert "/run/dagent/workspace-token" in containers["workspace-manager"]["command"][2]
    assert {
        mount.get("subPath") for mount in containers["workspace-manager"]["volumeMounts"]
    } >= {"workspace-token"}

    assert service["metadata"]["name"] == "dagent-requirement-101"
    assert {port["port"] for port in service["spec"]["ports"]} == {4096, 4097, 4098, 8090}
    assert claim["spec"]["storageClassName"] == "test-storage"
    assert claim["spec"]["resources"]["requests"]["storage"] == "8Gi"


def test_runtime_patch_replaces_old_pod_lists_without_update_permission():
    patch = build_runtime_deployment_patch(
        runtime_settings(), requirement_id=101, tenant_id=7
    )
    pod = patch["spec"]["template"]["spec"]

    for field in ("initContainers", "containers", "volumes"):
        assert pod[field][0] == {"$patch": "replace"}
    assert {container["name"] for container in pod["containers"][1:]} == {
        "requirement-clarification",
        "development-document",
        "development",
        "workspace-manager",
    }


def test_all_three_agent_roles_use_independent_containers_in_the_requirement_runtime():
    settings = runtime_settings()
    runtime = AgentRuntime(settings)
    for role, port in AGENT_ROLE_PORTS.items():
        assert runtime._server_url_for_role(
            role, requirement_id=101
        ) == f"http://dagent-requirement-101:{port}"

    assert requirement_runtime_url(settings, 101, 8090) == "http://dagent-requirement-101:8090"
    image_directories = {
        "requirement_clarification": "requirement-clarification",
        "development_document": "development-document",
        "development": "development",
    }
    for role, directory in image_directories.items():
        config = json.loads(
            Path(f"k8s/agent/images/{directory}/opencode.json").read_text(encoding="utf-8")
        )
        assert set(config["agent"]) == {role}
    assert json.loads(
        Path("k8s/agent/images/requirement-clarification/opencode.json").read_text(
            encoding="utf-8"
        )
    )["agent"]["requirement_clarification"]["permission"]["edit"] == "deny"
    assert json.loads(
        Path("k8s/agent/images/development-document/opencode.json").read_text(
            encoding="utf-8"
        )
    )["agent"]["development_document"]["permission"]["edit"] == "deny"
    assert json.loads(
        Path("k8s/agent/images/development/opencode.json").read_text(encoding="utf-8")
    )["agent"]["development"]["permission"]["edit"] == "allow"


def test_runtime_credentials_are_unique_per_requirement_and_scope():
    settings = runtime_settings()
    values = {
        requirement_runtime_secret_value(settings, requirement_id, scope)
        for requirement_id in (101, 102)
        for scope in (
            "opencode:requirement_clarification",
            "opencode:development_document",
            "opencode:development",
            "workspace",
        )
    }
    assert len(values) == 8
