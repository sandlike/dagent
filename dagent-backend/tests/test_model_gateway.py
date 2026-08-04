import httpx
from httpx import AsyncClient
from sqlalchemy import select

from dagent.api.schemas.model_gateway import ModelRouteTestResult
from dagent.api.v1.model_proxy import _fallback_error
from dagent.db.session import async_session
from dagent.models import AgentTask, ModelQuotaLedger, Requirement, UserModelQuota


def payload(response):
    assert response.status_code < 400, response.text
    body = response.json()
    assert body["code"] == 0
    return body["data"]


def test_only_provider_failures_are_eligible_for_automatic_fallback():
    assert _fallback_error(401) == "authentication_error"
    assert _fallback_error(403) == "authentication_error"
    assert _fallback_error(429) == "rate_limited"
    assert _fallback_error(503) == "server_error"
    assert _fallback_error(400) is None
    assert _fallback_error(422) is None


async def test_model_gateway_reserves_falls_back_settles_and_audits(
    client: AsyncClient, users, monkeypatch
):
    async def healthy_probe(_route):
        return ModelRouteTestResult(
            ok=True,
            latency_ms=12,
            health_status="healthy",
            sample_models=["test-model"],
            message="ok",
        )

    monkeypatch.setattr("dagent.api.v1.model_gateway.probe_model_route", healthy_probe)
    admin_headers = users["admin"]["headers"]

    async def create_active_route(name: str, priority: int):
        route = payload(
            await client.post(
                "/api/v1/model-routes",
                json={
                    "name": name,
                    "provider": "openai-compatible",
                    "model": "test-model",
                    "base_url": "http://localhost:8000/v1",
                    "priority": priority,
                    "quota_limit": 1000,
                    "fallback_on": ["timeout", "quota_exhausted"],
                    "agent_types": ["development"],
                    "environments": ["test"],
                },
                headers=admin_headers,
            )
        )
        test_result = payload(
            await client.post(f"/api/v1/model-routes/{route['id']}/test", headers=admin_headers)
        )
        assert test_result["ok"] is True
        return payload(
            await client.post(f"/api/v1/model-routes/{route['id']}/enable", headers=admin_headers)
        )

    primary = await create_active_route("gateway-test-primary", 1)
    secondary = await create_active_route("gateway-test-secondary", 2)

    denied = await client.get("/api/v1/model-routes", headers=users["developer"]["headers"])
    assert denied.status_code == 403

    project = payload(
        await client.post(
            "/api/v1/projects",
            json={"name": "Gateway test project", "member_ids": [users["developer"]["id"]]},
            headers=users["pm"]["headers"],
        )
    )
    requirement = payload(
        await client.post(
            "/api/v1/requirements",
            json={
                "project_id": project["id"],
                "title": "Exercise model routing",
                "description": "Verify quota reservation and fallback.",
            },
            headers={**users["pm"]["headers"], "Idempotency-Key": "gateway-test-requirement"},
        )
    )
    async with async_session() as session:
        task = AgentTask(
            tenant_id=1,
            requirement_id=requirement["id"],
            stage="development",
            task_type="development",
            idempotency_key="gateway-test-task",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        task_id = task.id

    callback_headers = {"Authorization": "Bearer test-agent-token"}
    reservation = payload(
        await client.post(
            "/api/v1/internal/model-reservations",
            json={
                "task_id": task_id,
                "request_id": "gateway-test-request",
                "estimated_tokens": 600,
                "estimated_input_tokens": 400,
                "output_token_budget": 200,
                "environment": "test",
            },
            headers=callback_headers,
        )
    )
    assert reservation["route"]["id"] == primary["id"]

    fallback = payload(
        await client.post(
            "/api/v1/internal/model-reservations/gateway-test-request/fallback",
            json={
                "task_id": task_id,
                "attempt_no": 1,
                "estimated_tokens": 600,
                "estimated_input_tokens": 400,
                "output_token_budget": 200,
                "error_type": "timeout",
                "latency_ms": 30000,
                "environment": "test",
            },
            headers=callback_headers,
        )
    )
    assert fallback["attempt_no"] == 2
    assert fallback["route"]["id"] == secondary["id"]

    third_attempt = await client.post(
        "/api/v1/internal/model-reservations/gateway-test-request/fallback",
        json={
            "task_id": task_id,
            "attempt_no": 2,
            "estimated_tokens": 600,
            "estimated_input_tokens": 400,
            "output_token_budget": 200,
            "error_type": "timeout",
            "latency_ms": 30000,
            "environment": "test",
        },
        headers=callback_headers,
    )
    assert third_attempt.status_code == 409
    assert third_attempt.json()["message"] == "Model fallback limit reached"

    payload(
        await client.post(
            "/api/v1/internal/model-reservations/gateway-test-request/settle",
            json={
                "task_id": task_id,
                "attempt_no": 2,
                "input_tokens": 350,
                "output_tokens": 150,
                "latency_ms": 850,
            },
            headers=callback_headers,
        )
    )

    logs = payload(
        await client.get(
            "/api/v1/model-call-logs?trace_id=" + "gateway-test-request",
            headers=admin_headers,
        )
    )
    assert logs["total"] == 0
    logs = payload(
        await client.get(
            f"/api/v1/model-call-logs?task_id={task_id}",
            headers=admin_headers,
        )
    )
    assert logs["total"] == 2
    assert {item["status"] for item in logs["items"]} == {"failed", "succeeded"}
    assert len({item["trace_id"] for item in logs["items"]}) == 1
    fallback_log = next(item for item in logs["items"] if item["attempt_no"] == 2)
    assert fallback_log["estimated_input_tokens"] == 400
    assert fallback_log["output_token_budget"] == 200
    assert fallback_log["reserved_tokens"] == 600
    assert fallback_log["released_tokens"] == 100
    assert fallback_log["fallback_reason"] == "timeout"
    assert fallback_log["fallback_from_route_id"] == primary["id"]

    usage = payload(await client.get("/api/v1/model-usage", headers=admin_headers))
    usage_by_route = {item["route_id"]: item for item in usage}
    assert usage_by_route[primary["id"]]["reserved_tokens"] == 0
    assert usage_by_route[secondary["id"]]["used_tokens"] == 500

    upstream_statuses = [429, 503]

    class FailingUpstreamClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            return httpx.Response(upstream_statuses.pop(0), json={"error": {"message": "upstream failed"}})

    monkeypatch.setattr("dagent.api.v1.model_proxy.httpx.AsyncClient", FailingUpstreamClient)
    proxy_response = await client.post(
        "/api/v1/model-proxy/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": f"[DAGENT_CONTEXT task_id={task_id}] verify fallback"}],
            "max_tokens": 100,
        },
        headers={
            **callback_headers,
            "X-Request-Id": "gateway-upstream-failure-request",
            "X-Dagent-Environment": "test",
        },
    )
    assert proxy_response.status_code == 503
    assert upstream_statuses == []
    async with async_session() as session:
        failed_ledgers = list(
            (
                await session.scalars(
                    select(ModelQuotaLedger)
                    .where(ModelQuotaLedger.request_id == "gateway-upstream-failure-request")
                    .order_by(ModelQuotaLedger.attempt_no)
                )
            ).all()
        )
    assert len(failed_ledgers) == 2
    assert all(item.status == "failed" for item in failed_ledgers)
    assert all(item.released_tokens == item.reserved_tokens for item in failed_ledgers)
    failed_logs = payload(
        await client.get(
            f"/api/v1/model-call-logs?task_id={task_id}",
            headers=admin_headers,
        )
    )
    proxy_logs = [
        item for item in failed_logs["items"] if item["request_id"] == "gateway-upstream-failure-request"
    ]
    assert len(proxy_logs) == 2
    second_proxy_log = next(item for item in proxy_logs if item["attempt_no"] == 2)
    assert second_proxy_log["fallback_from_route_id"] == primary["id"]
    assert second_proxy_log["fallback_reason"] == "rate_limited"
    assert second_proxy_log["error_type"] == "server_error"
    assert second_proxy_log["released_tokens"] == second_proxy_log["reserved_tokens"]

    binding = payload(
        await client.put(
            f"/api/v1/projects/{project['id']}/model-route",
            json={"route_id": secondary["id"], "resource_version": 1},
            headers=admin_headers,
        )
    )
    assert binding["route_id"] == secondary["id"]
    visible_binding = payload(
        await client.get(
            f"/api/v1/projects/{project['id']}/model-route",
            headers=users["developer"]["headers"],
        )
    )
    assert visible_binding["route_name"] == "gateway-test-secondary"


async def test_user_model_pools_bindings_quota_and_fallback_are_isolated(
    client: AsyncClient, users, monkeypatch
):
    async def healthy_user_probe(_route):
        return ModelRouteTestResult(
            ok=True,
            latency_ms=9,
            health_status="healthy",
            sample_models=["test-model"],
            message="ok",
        )

    monkeypatch.setattr("dagent.api.v1.user_model_gateway.probe_model_route", healthy_user_probe)
    developer_headers = users["developer"]["headers"]
    pm_headers = users["pm"]["headers"]

    developer_gateway = payload(await client.get("/api/v1/me/model-gateway", headers=developer_headers))
    pm_gateway_before = payload(await client.get("/api/v1/me/model-gateway", headers=pm_headers))
    assert len(developer_gateway["routes"]) >= 2
    assert len(pm_gateway_before["routes"]) >= 2
    assert {item["id"] for item in developer_gateway["routes"]}.isdisjoint(
        {item["id"] for item in pm_gateway_before["routes"]}
    )
    assert {item["agent_type"] for item in developer_gateway["bindings"]} == {
        "requirement_clarification",
        "development",
    }
    assert "base_url" not in developer_gateway["routes"][0]
    assert "credential_ref" not in developer_gateway["routes"][0]
    assert isinstance(developer_gateway["routes"][0]["credential_configured"], bool)
    verification = payload(
        await client.post(
            f"/api/v1/me/model-routes/{developer_gateway['routes'][0]['id']}/test",
            headers=developer_headers,
        )
    )
    assert verification["ok"] is True

    route_ids = [item["id"] for item in developer_gateway["routes"][:2]]
    bindings_by_type = {item["agent_type"]: item for item in developer_gateway["bindings"]}
    for agent_type in ("requirement_clarification", "development"):
        updated = payload(
            await client.put(
                f"/api/v1/me/agent-model-bindings/{agent_type}",
                json={
                    "route_ids": list(reversed(route_ids)),
                    "resource_version": bindings_by_type[agent_type]["resource_version"],
                },
                headers=developer_headers,
            )
        )
        assert updated["route_ids"] == list(reversed(route_ids))

    refreshed = payload(await client.get("/api/v1/me/model-gateway", headers=developer_headers))
    development_binding = next(
        item for item in refreshed["bindings"] if item["agent_type"] == "development"
    )
    payload(
        await client.put(
            "/api/v1/me/agent-model-bindings/development",
            json={"route_ids": route_ids, "resource_version": development_binding["resource_version"]},
            headers=developer_headers,
        )
    )
    primary = next(item for item in refreshed["routes"] if item["id"] == route_ids[0])
    payload(
        await client.patch(
            f"/api/v1/me/model-routes/{primary['id']}",
            json={"quota_limit": 100, "resource_version": primary["resource_version"]},
            headers=developer_headers,
        )
    )

    async with async_session() as session:
        user_quota = await session.scalar(
            select(UserModelQuota).where(UserModelQuota.user_id == users["developer"]["id"])
        )
        assert user_quota is not None
        user_quota.quota_limit = 100
        user_quota.hard_limit_enabled = False
        await session.commit()

    async with async_session() as session:
        requirement = await session.scalar(select(Requirement).order_by(Requirement.id.desc()))
        assert requirement is not None
        task = AgentTask(
            tenant_id=requirement.tenant_id,
            requirement_id=requirement.id,
            requested_by=users["developer"]["id"],
            stage="development",
            task_type="development",
            idempotency_key="user-model-isolation-task",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        task_id = task.id

    callback_headers = {"Authorization": "Bearer test-agent-token"}
    reservation = payload(
        await client.post(
            "/api/v1/internal/model-reservations",
            json={
                "task_id": task_id,
                "request_id": "user-model-isolation-request",
                "estimated_tokens": 200,
                "estimated_input_tokens": 120,
                "output_token_budget": 80,
                "environment": "test",
            },
            headers=callback_headers,
        )
    )
    async with async_session() as session:
        ledger = await session.scalar(
            select(ModelQuotaLedger).where(
                ModelQuotaLedger.request_id == "user-model-isolation-request"
            )
        )
        assert ledger is not None
        assert ledger.user_id == users["developer"]["id"]
        assert ledger.user_route_id == route_ids[1]
    payload(
        await client.post(
            "/api/v1/internal/model-reservations/user-model-isolation-request/settle",
            json={
                "task_id": task_id,
                "attempt_no": reservation["attempt_no"],
                "input_tokens": 100,
                "output_tokens": 50,
                "latency_ms": 120,
            },
            headers=callback_headers,
        )
    )

    developer_after = payload(await client.get("/api/v1/me/model-gateway", headers=developer_headers))
    pm_after = payload(await client.get("/api/v1/me/model-gateway", headers=pm_headers))
    assert developer_after["quota"]["quota_used"] == 150
    assert developer_after["quota"]["hard_limit_enabled"] is False
    assert developer_after["quota"]["quota_remaining"] is None
    assert pm_after["quota"]["quota_used"] == pm_gateway_before["quota"]["quota_used"]
    backup = next(item for item in developer_after["routes"] if item["id"] == route_ids[1])
    assert backup["quota_used"] == 150

    logs = payload(await client.get("/api/v1/me/model-call-logs", headers=developer_headers))
    matching_log = next(item for item in logs["items"] if item["task_id"] == task_id)
    assert matching_log["user_id"] == users["developer"]["id"]
    assert matching_log["agent_type"] == "development"
    assert matching_log["user_route_id"] == route_ids[1]
    assert matching_log["model"] == "test-model"
    assert matching_log["estimated_input_tokens"] == 120
    assert matching_log["output_token_budget"] == 80
    assert matching_log["reserved_tokens"] == 200
    assert matching_log["released_tokens"] == 50
    assert matching_log["fallback_from_user_route_id"] == route_ids[0]
    assert matching_log["fallback_reason"] == "quota_exhausted"

    settings = payload(
        await client.put(
            "/api/v1/me/model-gateway/settings",
            json={
                "auto_fallback": False,
                "resource_version": developer_after["quota"]["resource_version"],
            },
            headers=developer_headers,
        )
    )
    assert settings["auto_fallback"] is False
    async with async_session() as session:
        requirement = await session.scalar(select(Requirement).order_by(Requirement.id.desc()))
        assert requirement is not None
        task = AgentTask(
            tenant_id=requirement.tenant_id,
            requirement_id=requirement.id,
            requested_by=users["developer"]["id"],
            stage="development",
            task_type="development",
            idempotency_key="user-model-no-fallback-task",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        no_fallback_task_id = task.id
    exhausted = await client.post(
        "/api/v1/internal/model-reservations",
        json={
            "task_id": no_fallback_task_id,
            "request_id": "user-model-no-fallback-request",
            "estimated_tokens": 200,
            "estimated_input_tokens": 120,
            "output_token_budget": 80,
            "environment": "test",
        },
        headers=callback_headers,
    )
    assert exhausted.status_code == 409
    assert exhausted.json()["message"] == "所有模型节点额度不足"
    proxy_quota_error = await client.post(
        "/api/v1/model-proxy/v1/chat/completions",
        json={
            "model": "test-model",
            "messages": [
                {
                    "role": "user",
                    "content": f"[DAGENT_CONTEXT task_id={no_fallback_task_id}] quota check",
                }
            ],
            "max_tokens": 200,
        },
        headers={**callback_headers, "X-Request-Id": "non-retryable-quota-request"},
    )
    assert proxy_quota_error.status_code == 400
    assert proxy_quota_error.json()["error"] == {
        "message": "所有模型节点额度不足",
        "type": "quota_exhausted",
        "retryable": False,
    }

    hard_budget = payload(
        await client.put(
            f"/api/v1/users/{users['developer']['id']}/model-quota",
            json={
                "quota_limit": 150,
                "hard_limit_enabled": True,
                "resource_version": settings["resource_version"],
            },
            headers=users["admin"]["headers"],
        )
    )
    assert hard_budget["hard_limit_enabled"] is True
    assert hard_budget["quota_remaining"] == 0
    budget_exhausted = await client.post(
        "/api/v1/internal/model-reservations",
        json={
            "task_id": no_fallback_task_id,
            "request_id": "user-total-budget-exhausted-request",
            "estimated_tokens": 1,
            "estimated_input_tokens": 1,
            "output_token_budget": 0,
            "environment": "test",
        },
        headers=callback_headers,
    )
    assert budget_exhausted.status_code == 409
    assert budget_exhausted.json()["message"] == "用户总预算不足"
