import httpx
from httpx import AsyncClient
from sqlalchemy import select

from dagent.api.schemas.model_gateway import ModelRouteTestResult
from dagent.api.v1.model_proxy import _fallback_error, _responses_request, _responses_to_chat
from dagent.db.session import async_session
from dagent.models import AgentTask, ModelQuotaLedger, ModelRoute, Requirement, UserModelQuota
from dagent.services.credentials import decrypt_model_token
from dagent.services.model_gateway import probe_model_route


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


async def test_admin_can_add_a_new_model_with_an_encrypted_api_token(client: AsyncClient, users):
    raw_token = "test-model-token-not-for-storage"
    created = payload(
        await client.post(
            "/api/v1/model-routes",
            json={
                "name": "admin-created-model",
                "provider": "openai-compatible",
                "model": "new-model",
                "base_url": "http://localhost:8000/v1",
                "priority": 20,
                "quota_limit": 50000,
                "api_token": raw_token,
            },
            headers=users["admin"]["headers"],
        )
    )
    assert created["credential_configured"] is True
    assert "api_token" not in created
    assert "credential_ciphertext" not in created

    async with async_session() as session:
        route = await session.get(ModelRoute, created["id"])
        assert route is not None
        assert route.credential_ref is None
        assert route.credential_ciphertext
        assert route.credential_ciphertext != raw_token
        assert decrypt_model_token(route.credential_ciphertext) == raw_token

    denied = await client.post(
        "/api/v1/model-routes",
        json={
            "name": "developer-created-model",
            "provider": "openai-compatible",
            "model": "new-model",
            "base_url": "http://localhost:8000/v1",
            "priority": 21,
            "quota_limit": 50000,
            "api_token": raw_token,
        },
        headers=users["developer"]["headers"],
    )
    assert denied.status_code == 403


async def test_model_route_probe_accepts_a_configured_public_host(monkeypatch):
    requested_urls: list[str] = []
    completion_payloads: list[dict] = []

    class ModelsResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"id": "test-model"}]}

    class CompletionResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "OK"}}]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, headers):
            requested_urls.append(url)
            return ModelsResponse()

        async def post(self, url, headers, json):
            requested_urls.append(url)
            completion_payloads.append(json)
            return CompletionResponse()

    monkeypatch.setattr("dagent.services.model_gateway.httpx.AsyncClient", FakeClient)
    result = await probe_model_route(
        ModelRoute(
            base_url="https://shayulajiao.xyz/v1",
            model="test-model",
            timeout_ms=1_000,
            credential_ref=None,
            credential_ciphertext=None,
        )
    )

    assert result.ok is True
    assert result.response_preview == "OK"
    assert requested_urls == [
        "https://shayulajiao.xyz/v1/models",
        "https://shayulajiao.xyz/v1/chat/completions",
    ]
    assert completion_payloads == [
        {
            "model": "test-model",
            "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
            "max_tokens": 256,
            "stream": False,
        }
    ]


async def test_model_route_probe_rejects_an_empty_success_response(monkeypatch):
    class FakeResponse:
        status_code = 200

        def __init__(self, body):
            self.body = body

        def raise_for_status(self):
            return None

        def json(self):
            return self.body

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return FakeResponse({"data": [{"id": "test-model"}]})

        async def post(self, *_args, **_kwargs):
            return FakeResponse({"choices": []})

    monkeypatch.setattr("dagent.services.model_gateway.httpx.AsyncClient", FakeClient)
    result = await probe_model_route(
        ModelRoute(
            base_url="https://example.com/v1",
            model="test-model",
            timeout_ms=1_000,
            credential_ref=None,
            credential_ciphertext=None,
        )
    )

    assert result.ok is False
    assert result.health_status == "unhealthy"
    assert result.response_preview is None
    assert result.message.startswith("No supported model API protocol detected")


async def test_model_route_probe_auto_detects_responses_api(monkeypatch):
    requested_urls: list[str] = []

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        def __init__(self, body, error=False):
            self.body = body
            self.error = error

        def raise_for_status(self):
            if self.error:
                raise httpx.HTTPError("unsupported")

        def json(self):
            return self.body

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return FakeResponse({})

        async def post(self, url, **_kwargs):
            requested_urls.append(url)
            if url.endswith("/chat/completions"):
                return FakeResponse({}, error=True)
            return FakeResponse(
                {
                    "id": "resp_test",
                    "output": [
                        {
                            "type": "message",
                            "content": [{"type": "output_text", "text": "OK"}],
                        }
                    ],
                }
            )

    monkeypatch.setattr("dagent.services.model_gateway.httpx.AsyncClient", FakeClient)
    result = await probe_model_route(
        ModelRoute(
            base_url="https://example.com/v1",
            model="test-model",
            timeout_ms=1_000,
            credential_ref=None,
            credential_ciphertext=None,
        )
    )

    assert result.ok is True
    assert result.detected_api_protocol == "responses"
    assert result.response_preview == "OK"
    assert requested_urls == [
        "https://example.com/v1/chat/completions",
        "https://example.com/v1/responses",
    ]


def test_responses_request_and_result_are_translated_to_chat_contract():
    request = _responses_request(
        {
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 256,
        },
        "test-model",
    )
    assert request == {
        "model": "test-model",
        "input": [{"role": "user", "content": "hello"}],
        "stream": False,
        "max_output_tokens": 256,
    }
    response = _responses_to_chat(
        {
            "id": "resp_test",
            "model": "test-model",
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "hello"}],
                }
            ],
            "usage": {"input_tokens": 3, "output_tokens": 2, "total_tokens": 5},
        },
        "test-model",
    )
    assert response["choices"][0]["message"]["content"] == "hello"
    assert response["usage"] == {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5}


async def test_model_route_probe_still_tests_chat_when_models_metadata_is_not_json(monkeypatch):
    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            raise ValueError("not json")

    class CompletionResponse(FakeResponse):
        def json(self):
            return {"choices": [{"message": {"content": "OK"}}]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return FakeResponse()

        async def post(self, *_args, **_kwargs):
            return CompletionResponse()

    monkeypatch.setattr("dagent.services.model_gateway.httpx.AsyncClient", FakeClient)
    result = await probe_model_route(
        ModelRoute(
            base_url="https://example.com/v1",
            model="test-model",
            timeout_ms=1_000,
            credential_ref=None,
            credential_ciphertext=None,
        )
    )

    assert result.ok is True
    assert result.sample_models == []
    assert result.response_preview == "OK"


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

    async def create_active_route(
        name: str,
        priority: int,
        agent_types: list[str] | None = None,
    ):
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
                    "agent_types": agent_types if agent_types is not None else [],
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

    clarification_only = await create_active_route(
        "gateway-test-clarification-only",
        1,
        ["requirement_clarification"],
    )
    primary = await create_active_route("gateway-test-primary", 2)
    secondary = await create_active_route("gateway-test-secondary", 3)

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
    assert reservation["route"]["id"] != clarification_only["id"]
    payload(
        await client.post(
            f"/api/v1/model-routes/{clarification_only['id']}/disable",
            headers=admin_headers,
        )
    )

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


async def test_platform_model_bindings_share_route_quota_and_user_budgets(client: AsyncClient, users):
    developer_headers = users["developer"]["headers"]
    pm_headers = users["pm"]["headers"]

    developer_gateway = payload(await client.get("/api/v1/me/model-gateway", headers=developer_headers))
    pm_gateway_before = payload(await client.get("/api/v1/me/model-gateway", headers=pm_headers))
    assert len(developer_gateway["routes"]) >= 2
    assert len(pm_gateway_before["routes"]) >= 2
    assert {item["id"] for item in developer_gateway["routes"]} == {
        item["id"] for item in pm_gateway_before["routes"]
    }
    assert {item["agent_type"] for item in developer_gateway["bindings"]} == {
        "requirement_clarification",
        "development",
    }
    assert "base_url" not in developer_gateway["routes"][0]
    assert "credential_ref" not in developer_gateway["routes"][0]
    assert isinstance(developer_gateway["routes"][0]["credential_configured"], bool)
    removed_user_route_api = await client.post(
        f"/api/v1/me/model-routes/{developer_gateway['routes'][0]['id']}/test",
        headers=developer_headers,
    )
    assert removed_user_route_api.status_code == 404

    route_ids = [item["id"] for item in developer_gateway["routes"][:2]]
    bindings_by_type = {item["agent_type"]: item for item in developer_gateway["bindings"]}
    duplicate_priority = await client.put(
        "/api/v1/me/agent-model-bindings/development",
        json={
            "route_ids": [route_ids[0], route_ids[0]],
            "resource_version": bindings_by_type["development"]["resource_version"],
        },
        headers=developer_headers,
    )
    assert duplicate_priority.status_code == 422
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
    initial_shared_quota = next(item for item in refreshed["routes"] if item["id"] == route_ids[1])[
        "quota_used"
    ]
    async with async_session() as session:
        platform_route = await session.get(ModelRoute, primary["id"])
        assert platform_route is not None
        platform_route.quota_limit = 100
        await session.commit()

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
        assert ledger.route_id == route_ids[1]
        assert ledger.user_route_id is None
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
    assert backup["quota_used"] == initial_shared_quota + 150
    pm_backup = next(item for item in pm_after["routes"] if item["id"] == route_ids[1])
    assert pm_backup["quota_used"] == backup["quota_used"]

    logs = payload(await client.get("/api/v1/me/model-call-logs", headers=developer_headers))
    matching_log = next(item for item in logs["items"] if item["task_id"] == task_id)
    assert matching_log["user_id"] == users["developer"]["id"]
    assert matching_log["agent_type"] == "development"
    assert matching_log["route_id"] == route_ids[1]
    assert matching_log["model"] == "test-model"
    assert matching_log["estimated_input_tokens"] == 120
    assert matching_log["output_token_budget"] == 80
    assert matching_log["reserved_tokens"] == 200
    assert matching_log["released_tokens"] == 50
    assert matching_log["fallback_from_route_id"] == route_ids[0]
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
