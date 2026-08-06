from httpx import AsyncClient

from dagent.api.errors import ExternalDependencyError
from dagent.db.session import async_session
from dagent.models import Requirement, RequirementWorkspace


def payload(response):
    assert response.status_code < 400, response.text
    body = response.json()
    assert body["code"] == 0
    return body["data"]


async def task_result(client: AsyncClient, task_id: int, result: dict):
    response = await client.post(
        f"/api/v1/internal/agent-tasks/{task_id}/result",
        json=result,
        headers={"Authorization": "Bearer test-agent-token"},
    )
    return payload(response)


def manual_test_plan(case_id: str, title: str, expected_result: str) -> dict:
    return {
        "summary": "Manual acceptance plan",
        "test_scope": ["Order risk-limit behavior"],
        "test_environment": ["Staging environment with the approved build"],
        "preconditions": ["Risk limit is configured as CNY 1,000,000"],
        "risk_points": ["Boundary amount handling"],
        "entry_criteria": ["Development report is approved"],
        "exit_criteria": ["All P0 manual cases pass"],
        "manual_test_cases": [
            {
                "id": case_id,
                "title": title,
                "preconditions": ["The user can submit an order"],
                "steps": ["Submit the configured order"],
                "expected_result": expected_result,
                "priority": "P0",
                "automated": False,
            }
        ],
    }


def development_result(summary: str) -> dict:
    return {
        "status": "succeeded",
        "artifact_content": {
            "summary": summary,
            "tests_passed": True,
            "changed_files": [{"path": "orders/service.py", "change": summary}],
            "checks": [
                {
                    "name": "pytest unit tests",
                    "command": "pytest tests/test_orders.py -q",
                    "status": "passed",
                    "summary": "Relevant unit tests passed",
                    "exit_code": 0,
                },
                {
                    "type": "smoke",
                    "command": "python scripts/smoke_order.py",
                    "status": "passed",
                    "summary": "Order API smoke check passed",
                    "exit_code": 0,
                },
            ],
        },
    }


async def test_complete_pipeline_uses_two_long_lived_agent_sessions(client, users, monkeypatch):
    pm = users["pm"]
    developer = users["developer"]

    project = payload(
        await client.post(
            "/api/v1/projects",
            json={
                "name": "Trading platform",
                "description": "Dagent integration project",
                "member_ids": [developer["id"]],
            },
            headers=pm["headers"],
        )
    )
    repository = payload(
        await client.post(
            f"/api/v1/projects/{project['id']}/repositories",
            json={
                "name": "trading-api",
                "provider": "git",
                "url": "https://example.invalid/trading-api.git",
                "default_branch": "main",
            },
            headers=pm["headers"],
        )
    )
    requirement = payload(
        await client.post(
            "/api/v1/requirements",
            json={
                "project_id": project["id"],
                "title": "Add order risk check",
                "description": "Reject an order when its notional exceeds the configured limit.",
                "priority": "P0",
                "repository_ids": [repository["id"]],
            },
            headers={**pm["headers"], "Idempotency-Key": "create-requirement-1"},
        )
    )
    requirement = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/submit",
            json={"resource_version": requirement["version"]},
            headers=pm["headers"],
        )
    )
    assert requirement["stage"] == "requirement_clarification"

    clarification_task = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/clarification/generate",
            headers={**pm["headers"], "Idempotency-Key": "clarification-1"},
        )
    )
    assert clarification_task["agent_version_id"] is not None
    requirement_session_id = clarification_task["session_id"]
    assert requirement_session_id is not None
    await task_result(
        client,
        clarification_task["id"],
        {
            "status": "succeeded",
            "output_summary": "One business decision is required.",
            "clarification_questions": [
                {
                    "question": "What is the default notional limit?",
                    "question_type": "single",
                    "required": True,
                    "options": [
                        {"id": "limit-standard", "label": "CNY 1,000,000"},
                        {"id": "limit-high", "label": "CNY 5,000,000"},
                    ],
                }
            ],
        },
    )
    rounds = payload(
        await client.get(
            f"/api/v1/requirements/{requirement['id']}/clarification/rounds",
            headers=pm["headers"],
        )
    )
    current = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))
    answer = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/clarification/answers",
            json={
                "resource_version": current["version"],
                "answers": [{"question_id": rounds[0]["questions"][0]["id"], "answer": "limit-standard"}],
            },
            headers=pm["headers"],
        )
    )
    requirement = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/clarification/confirm",
            json={
                "resource_version": answer["resource_version"],
                "requirement_document": {
                    "goal": "Reject excessive order notional",
                    "default_limit": 1_000_000,
                    "currency": "CNY",
                },
            },
            headers=pm["headers"],
        )
    )
    assert requirement["stage"] == "development_document_generation"
    requirement_versions = payload(
        await client.get(
            f"/api/v1/requirements/{requirement['id']}/artifacts/requirement_document/versions",
            headers=pm["headers"],
        )
    )
    confirmed_document = requirement_versions[0]["content"]
    assert confirmed_document["schema_version"] == 1
    assert confirmed_document["confirmed_answers"][0]["answer"] == "CNY 1,000,000"
    assert confirmed_document["confirmed_answers"][0]["answer_value"] == "limit-standard"

    document_task = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/tasks",
            json={"input_summary": "Generate development document"},
            headers={**developer["headers"], "Idempotency-Key": "development-document-1"},
        )
    )
    await task_result(
        client,
        document_task["id"],
        {
            "status": "succeeded",
            "artifact_type": "development_document",
            "artifact_content": {"modules": ["orders", "risk"], "rollback": "revert commit"},
        },
    )
    development_document_versions = payload(
        await client.get(
            f"/api/v1/requirements/{requirement['id']}/artifacts/development_document/versions",
            headers=pm["headers"],
        )
    )
    stored_document = development_document_versions[0]["content"]
    assert stored_document == {"modules": ["orders", "risk"], "rollback": "revert commit"}
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))
    assert requirement["stage"] == "development_document_review"
    no_comment = await client.post(
        f"/api/v1/requirements/{requirement['id']}/reviews/development_document",
        json={
            "action": "reject",
            "comment": "",
            "artifact_version": 1,
            "resource_version": requirement["version"],
        },
        headers=pm["headers"],
    )
    assert no_comment.status_code == 409
    review = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/development_document",
            json={
                "action": "approve",
                "comment": "Approved",
                "artifact_version": 1,
                "resource_version": requirement["version"],
            },
            headers={**pm["headers"], "Idempotency-Key": "approve-development-document-1"},
        )
    )
    assert review["stage"] == "development"

    development_task = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/tasks",
            json={"input_summary": "Implement and test the risk check"},
            headers={**developer["headers"], "Idempotency-Key": "development-1"},
        )
    )
    development_session_id = development_task["session_id"]
    assert development_session_id is not None
    await task_result(
        client,
        development_task["id"],
        development_result("Implemented the risk check"),
    )
    missing_test_cases = await client.get(
        f"/api/v1/requirements/{requirement['id']}/artifacts/test_cases/versions",
        headers=developer["headers"],
    )
    assert missing_test_cases.status_code == 404
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=developer["headers"]))
    development_review = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/development_report",
            json={
                "action": "approve",
                "comment": "Implementation matches the document",
                "artifact_version": 1,
                "resource_version": requirement["version"],
            },
            headers=developer["headers"],
        )
    )
    assert development_review["stage"] == "test_plan_generation"
    assert development_review["agent_task_id"] is None
    test_plan_tasks = payload(
        await client.get(f"/api/v1/requirements/{requirement['id']}/tasks", headers=developer["headers"])
    )
    assert not any(item["task_type"] == "test_plan_generation" for item in test_plan_tasks)
    available_actions = payload(
        await client.get(f"/api/v1/requirements/{requirement['id']}/actions", headers=developer["headers"])
    )
    assert "start_task" in available_actions
    test_plan_task = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/tasks",
            json={"input_summary": "Generate the approved manual test plan"},
            headers={**developer["headers"], "Idempotency-Key": "test-plan-1"},
        )
    )
    test_plan_task_id = test_plan_task["id"]
    assert test_plan_task["task_type"] == "test_plan_generation"
    assert test_plan_task["session_id"] == development_session_id
    invalid_test_plan = await client.post(
        f"/api/v1/internal/agent-tasks/{test_plan_task_id}/result",
        json={
            "status": "succeeded",
            "artifact_type": "test_plan",
            "artifact_content": "free-form Agent test plan output",
        },
        headers={"Authorization": "Bearer test-agent-token"},
    )
    assert invalid_test_plan.status_code == 200
    assert invalid_test_plan.json()["data"]["status"] == "succeeded"
    stored_raw_plan = payload(
        await client.get(
            f"/api/v1/requirements/{requirement['id']}/artifacts/test_plan/versions",
            headers=developer["headers"],
        )
    )
    assert stored_raw_plan[0]["content"] == "free-form Agent test plan output"
    await task_result(
        client,
        test_plan_task_id,
        {
            "status": "succeeded",
            "artifact_type": "test_plan",
            "artifact_content": manual_test_plan(
                "TC-RISK-001",
                "Reject an excessive order",
                "The order is rejected with the risk-limit reason",
            ),
        },
    )

    sessions = payload(
        await client.get(
            f"/api/v1/requirements/{requirement['id']}/agent-sessions",
            headers=developer["headers"],
        )
    )
    assert {item["role_type"] for item in sessions} == {
        "requirement_clarification",
        "development",
    }
    requirement_session = next(item for item in sessions if item["role_type"] == "requirement_clarification")
    assert requirement_session["id"] == requirement_session_id
    assert next(item for item in sessions if item["role_type"] == "development")["id"] == development_session_id
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))
    assert requirement["stage"] == "test_plan_review"
    assert requirement["run_status"] == "waiting_human"
    test_plan_review = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/test_plan",
            json={
                "action": "approve",
                "comment": "The manual test plan is complete",
                "artifact_version": 1,
                "resource_version": requirement["version"],
            },
            headers={**pm["headers"], "Idempotency-Key": "approve-test-plan-1"},
        )
    )
    assert test_plan_review["stage"] == "final_acceptance"
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))

    rework = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/final_acceptance",
            json={
                "action": "reject",
                "comment": "Cover the boundary response before acceptance",
                "artifact_version": 1,
                "resource_version": requirement["version"],
                "final_confirmation": False,
            },
            headers={**pm["headers"], "Idempotency-Key": "reject-final-acceptance-1"},
        )
    )
    assert rework["stage"] == "development"
    rework_task = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/tasks",
            json={"input_summary": "Address final acceptance feedback"},
            headers={**developer["headers"], "Idempotency-Key": "development-rework-1"},
        )
    )
    assert rework_task["task_type"] == "failure_fix"
    assert rework_task["session_id"] == development_session_id
    await task_result(
        client,
        rework_task["id"],
        development_result("Fixed the boundary condition"),
    )
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=developer["headers"]))
    second_development_review = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/development_report",
            json={
                "action": "approve",
                "comment": "Rework accepted",
                "artifact_version": 2,
                "resource_version": requirement["version"],
            },
            headers=developer["headers"],
        )
    )
    assert second_development_review["stage"] == "test_plan_generation"
    assert second_development_review["agent_task_id"] is None
    second_task_detail = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/tasks",
            json={"input_summary": "Generate the revised manual test plan"},
            headers={**developer["headers"], "Idempotency-Key": "test-plan-2"},
        )
    )
    second_test_plan_task = second_task_detail["id"]
    assert second_task_detail["task_type"] == "test_plan_generation"
    assert second_task_detail["session_id"] == development_session_id
    await task_result(
        client,
        second_test_plan_task,
        {
            "status": "succeeded",
            "artifact_type": "test_plan",
            "artifact_content": manual_test_plan(
                "TC-RISK-002",
                "Accept an order exactly at the limit",
                "The order is accepted",
            ),
        },
    )
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))
    assert requirement["stage"] == "test_plan_review"
    rejected_test_plan = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/test_plan",
            json={
                "action": "reject",
                "comment": "Add a manual case for an order below the limit",
                "artifact_version": 2,
                "resource_version": requirement["version"],
            },
            headers={**pm["headers"], "Idempotency-Key": "reject-test-plan-2"},
        )
    )
    assert rejected_test_plan["stage"] == "test_plan_generation"
    third_task_detail = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/tasks",
            json={"input_summary": "Revise the manual test plan using the rejection feedback"},
            headers={**developer["headers"], "Idempotency-Key": "test-plan-3"},
        )
    )
    assert third_task_detail["task_type"] == "test_plan_generation"
    assert third_task_detail["session_id"] == development_session_id
    await task_result(
        client,
        third_task_detail["id"],
        {
            "status": "succeeded",
            "artifact_type": "test_plan",
            "artifact_content": manual_test_plan(
                "TC-RISK-003",
                "Accept an order below the limit",
                "The order is accepted",
            ),
        },
    )
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))
    assert requirement["stage"] == "test_plan_review"
    final_test_plan_review = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/test_plan",
            json={
                "action": "approve",
                "comment": "Revised manual test plan approved",
                "artifact_version": 3,
                "resource_version": requirement["version"],
            },
            headers={**pm["headers"], "Idempotency-Key": "approve-test-plan-3"},
        )
    )
    assert final_test_plan_review["stage"] == "final_acceptance"
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))

    async with async_session() as session:
        stored_requirement = await session.get(Requirement, requirement["id"])
        assert stored_requirement is not None
        session.add(
            RequirementWorkspace(
                tenant_id=stored_requirement.tenant_id,
                requirement_id=requirement["id"],
                repository_id=repository["id"],
                path=f"/workspaces/requirement-{requirement['id']}/repo",
                base_branch="main",
                branch_name=f"dagent/req-{requirement['id']}",
                baseline_commit="a" * 40,
                head_commit="b" * 40,
                status="committed",
                changed_files=["orders/service.py"],
            )
        )
        await session.commit()

    push_attempts = 0

    async def flaky_push(_self, path, credential):
        nonlocal push_attempts
        assert path.endswith("/repo")
        assert credential is None
        push_attempts += 1
        if push_attempts == 1:
            raise ExternalDependencyError("Remote Git is temporarily unavailable")
        return {"head_commit": "b" * 40, "changed_files": ["orders/service.py"]}

    monkeypatch.setattr("dagent.services.workspaces.WorkspaceManagerClient.push", flaky_push)

    missing_confirmation = await client.post(
        f"/api/v1/requirements/{requirement['id']}/reviews/final_acceptance",
        json={
            "action": "approve",
            "comment": "Accepted",
            "artifact_version": 3,
            "resource_version": requirement["version"],
            "final_confirmation": False,
        },
        headers=pm["headers"],
    )
    assert missing_confirmation.status_code == 409
    failed_delivery = await client.post(
        f"/api/v1/requirements/{requirement['id']}/reviews/final_acceptance",
        json={
            "action": "approve",
            "comment": "Accepted by product owner",
            "artifact_version": 3,
            "resource_version": requirement["version"],
            "final_confirmation": True,
        },
        headers={**pm["headers"], "Idempotency-Key": "final-acceptance-failed-push"},
    )
    assert failed_delivery.status_code == 503
    requirement = payload(await client.get(f"/api/v1/requirements/{requirement['id']}", headers=pm["headers"]))
    assert requirement["stage"] == "final_acceptance"
    assert requirement["run_status"] == "failed"
    acceptance = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/reviews/final_acceptance",
            json={
                "action": "approve",
                "comment": "Accepted by product owner",
                "artifact_version": 3,
                "resource_version": requirement["version"],
                "final_confirmation": True,
            },
            headers={**pm["headers"], "Idempotency-Key": "final-acceptance-1"},
        )
    )
    assert acceptance["stage"] == "completed"
    assert push_attempts == 2

    history = payload(
        await client.get(
            f"/api/v1/requirements/{requirement['id']}/pipeline",
            headers=pm["headers"],
        )
    )
    assert history["current_stage"] == "completed"
    assert len(history["history"]) == 16


async def test_stale_resource_version_is_rejected(client, users):
    pm = users["pm"]
    project = payload(
        await client.post(
            "/api/v1/projects",
            json={"name": "Version check", "member_ids": []},
            headers=pm["headers"],
        )
    )
    response = await client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Stale update", "resource_version": project["version"] + 1},
        headers=pm["headers"],
    )
    assert response.status_code == 409
    assert response.json()["code"] == 40900


async def test_users_endpoint_only_returns_public_profile_fields(client, users):
    response = await client.get("/api/v1/users", headers=users["pm"]["headers"])
    data = payload(response)
    assert {item["username"] for item in data} == {"admin", "pm", "developer", "qa"}
    assert all("password_hash" not in item for item in data)
