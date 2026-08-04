"""Shared pytest fixtures for dagent-agent tests."""

import pytest

from dagent_agent.agents.base import AgentContext, CodebaseInfo


@pytest.fixture
def sample_context() -> AgentContext:
    return AgentContext(
        requirement_id=1,
        project_id=1,
        tenant_id=1,
        codebase_info=[
            CodebaseInfo(
                repository_id=1,
                name="test-repo",
                git_url="https://example.com/test-repo.git",
                default_branch="main",
            )
        ],
        extra={"requirement_description": "Sample requirement for testing"},
    )
