from enum import Enum


class InvalidTransition(ValueError):
    pass


class PipelineState(str, Enum):
    REQUIREMENT_DRAFT = "requirement_draft"
    REQUIREMENT_CLARIFICATION = "requirement_clarification"
    DEVELOPMENT_DOCUMENT_GENERATION = "development_document_generation"
    DEVELOPMENT_DOCUMENT_REVIEW = "development_document_review"
    DEVELOPMENT = "development"
    DEVELOPMENT_REPORT_REVIEW = "development_report_review"
    TEST_PLAN_GENERATION = "test_plan_generation"
    FINAL_ACCEPTANCE = "final_acceptance"
    COMPLETED = "completed"


class RunStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    WAITING_HUMAN = "waiting_human"
    PAUSED = "paused"
    FAILED = "failed"
    CANCELLED = "cancelled"


TRANSITIONS: dict[tuple[PipelineState, str], PipelineState | None] = {
    (PipelineState.REQUIREMENT_DRAFT, "submit"): PipelineState.REQUIREMENT_CLARIFICATION,
    (PipelineState.REQUIREMENT_CLARIFICATION, "clarification_confirmed"): PipelineState.DEVELOPMENT_DOCUMENT_GENERATION,
    (PipelineState.DEVELOPMENT_DOCUMENT_GENERATION, "task_succeeded"): PipelineState.DEVELOPMENT_DOCUMENT_REVIEW,
    (PipelineState.DEVELOPMENT_DOCUMENT_REVIEW, "approve"): PipelineState.DEVELOPMENT,
    (PipelineState.DEVELOPMENT_DOCUMENT_REVIEW, "reject"): PipelineState.REQUIREMENT_CLARIFICATION,
    (PipelineState.DEVELOPMENT_REPORT_REVIEW, "approve"): PipelineState.TEST_PLAN_GENERATION,
    (PipelineState.DEVELOPMENT_REPORT_REVIEW, "reject"): PipelineState.DEVELOPMENT,
    (PipelineState.DEVELOPMENT, "task_succeeded"): PipelineState.DEVELOPMENT_REPORT_REVIEW,
    (PipelineState.TEST_PLAN_GENERATION, "task_succeeded"): PipelineState.FINAL_ACCEPTANCE,
    (PipelineState.FINAL_ACCEPTANCE, "approve"): PipelineState.COMPLETED,
    (PipelineState.FINAL_ACCEPTANCE, "reject"): PipelineState.DEVELOPMENT,
}


WAITING_HUMAN_STATES = {
    PipelineState.DEVELOPMENT_DOCUMENT_REVIEW,
    PipelineState.DEVELOPMENT_REPORT_REVIEW,
    PipelineState.FINAL_ACCEPTANCE,
}

AUTOMATED_STATES = {
    PipelineState.DEVELOPMENT_DOCUMENT_GENERATION,
    PipelineState.DEVELOPMENT,
    PipelineState.TEST_PLAN_GENERATION,
}


def next_state(current: PipelineState, action: str) -> PipelineState:
    target = TRANSITIONS.get((current, action))
    if target is None:
        raise InvalidTransition(f"Action '{action}' is not allowed from stage '{current.value}'")
    return target


def run_status_for(state: PipelineState) -> RunStatus:
    if state in WAITING_HUMAN_STATES:
        return RunStatus.WAITING_HUMAN
    return RunStatus.IDLE
