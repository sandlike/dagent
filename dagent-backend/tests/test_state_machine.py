import pytest

from dagent.pipeline.state_machine import (
    InvalidTransition,
    PipelineState,
    RunStatus,
    next_state,
    run_status_for,
)


def test_two_agent_happy_path_transitions():
    stage = PipelineState.REQUIREMENT_DRAFT
    transitions = [
        ("submit", PipelineState.REQUIREMENT_CLARIFICATION),
        ("clarification_confirmed", PipelineState.DEVELOPMENT_DOCUMENT_GENERATION),
        ("task_succeeded", PipelineState.DEVELOPMENT_DOCUMENT_REVIEW),
        ("approve", PipelineState.DEVELOPMENT),
        ("task_succeeded", PipelineState.DEVELOPMENT_REPORT_REVIEW),
        ("approve", PipelineState.TEST_PLAN_GENERATION),
        ("task_succeeded", PipelineState.TEST_PLAN_REVIEW),
        ("approve", PipelineState.FINAL_ACCEPTANCE),
        ("approve", PipelineState.COMPLETED),
    ]
    for action, expected in transitions:
        stage = next_state(stage, action)
        assert stage == expected


def test_gate_rejections_have_explicit_targets():
    assert next_state(PipelineState.DEVELOPMENT_DOCUMENT_REVIEW, "reject") == PipelineState.REQUIREMENT_CLARIFICATION
    assert next_state(PipelineState.DEVELOPMENT_REPORT_REVIEW, "reject") == PipelineState.DEVELOPMENT
    assert next_state(PipelineState.TEST_PLAN_REVIEW, "reject") == PipelineState.TEST_PLAN_GENERATION
    assert next_state(PipelineState.FINAL_ACCEPTANCE, "reject") == PipelineState.DEVELOPMENT


def test_human_gate_run_status_and_invalid_transition():
    assert run_status_for(PipelineState.FINAL_ACCEPTANCE) == RunStatus.WAITING_HUMAN
    assert run_status_for(PipelineState.TEST_PLAN_REVIEW) == RunStatus.WAITING_HUMAN
    with pytest.raises(InvalidTransition):
        next_state(PipelineState.DEVELOPMENT, "approve")
