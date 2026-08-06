from collections.abc import AsyncIterator

from sqlalchemy import inspect, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from dagent.config import get_settings
from dagent.models import AgentDefinition, AgentVersion, Base, Tenant, User
from dagent.security import hash_password

settings = get_settings()
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(_upgrade_existing_schema)


def _upgrade_existing_schema(connection) -> None:
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    dialect = connection.dialect.name
    if "agent_tasks" in tables:
        task_columns = {column["name"] for column in inspector.get_columns("agent_tasks")}
        if "session_id" not in task_columns:
            if dialect == "mysql":
                connection.execute(
                    text(
                        "ALTER TABLE agent_tasks ADD COLUMN session_id INTEGER NULL, "
                        "ADD CONSTRAINT fk_agent_tasks_session_id "
                        "FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL"
                    )
                )
            else:
                connection.execute(
                    text(
                        "ALTER TABLE agent_tasks ADD COLUMN session_id INTEGER NULL "
                        "REFERENCES agent_sessions(id)"
                    )
                )
            connection.execute(text("CREATE INDEX ix_agent_tasks_session_id ON agent_tasks (session_id)"))
        if "requested_by" not in task_columns:
            connection.execute(text("ALTER TABLE agent_tasks ADD COLUMN requested_by INTEGER NULL"))
            connection.execute(text("CREATE INDEX ix_agent_tasks_requested_by ON agent_tasks (requested_by)"))
            connection.execute(
                text(
                    "UPDATE agent_tasks SET requested_by = "
                    "(SELECT requirements.created_by FROM requirements "
                    "WHERE requirements.id = agent_tasks.requirement_id) "
                    "WHERE requested_by IS NULL"
                )
            )
        connection.execute(
            text(
                "UPDATE agent_tasks SET status = 'cancelled', "
                "error_message = 'Testing Agent retired by two-Agent workflow' "
                "WHERE task_type = 'test' AND status IN ('queued', 'running')"
            )
        )

    if "agent_sessions" in tables:
        connection.execute(
            text(
                "UPDATE agent_sessions SET status = 'retired' "
                "WHERE role_type = 'testing' AND status = 'active'"
            )
        )

    if "model_quota_ledger" in tables:
        ledger_columns = {column["name"] for column in inspector.get_columns("model_quota_ledger")}
        if "user_id" not in ledger_columns:
            connection.execute(text("ALTER TABLE model_quota_ledger ADD COLUMN user_id INTEGER NULL"))
            connection.execute(text("CREATE INDEX ix_model_quota_ledger_user_id ON model_quota_ledger (user_id)"))
        if "user_route_id" not in ledger_columns:
            connection.execute(text("ALTER TABLE model_quota_ledger ADD COLUMN user_route_id INTEGER NULL"))
            connection.execute(
                text("CREATE INDEX ix_model_quota_ledger_user_route_id ON model_quota_ledger (user_route_id)")
            )
        connection.execute(
            text(
                "UPDATE model_quota_ledger SET user_id = "
                "(SELECT agent_tasks.requested_by FROM agent_tasks "
                "WHERE agent_tasks.id = model_quota_ledger.task_id) "
                "WHERE user_id IS NULL AND task_id IS NOT NULL"
            )
        )

    if "model_routes" in tables:
        model_route_columns = {column["name"] for column in inspector.get_columns("model_routes")}
        if "api_protocol" not in model_route_columns:
            connection.execute(
                text(
                    "ALTER TABLE model_routes ADD COLUMN api_protocol VARCHAR(30) "
                    "NOT NULL DEFAULT 'auto'"
                )
            )
        if "detected_api_protocol" not in model_route_columns:
            connection.execute(text("ALTER TABLE model_routes ADD COLUMN detected_api_protocol VARCHAR(30) NULL"))
        if "credential_ciphertext" not in model_route_columns:
            connection.execute(text("ALTER TABLE model_routes ADD COLUMN credential_ciphertext TEXT NULL"))

    if "model_call_logs" in tables:
        log_columns = {column["name"] for column in inspector.get_columns("model_call_logs")}
        if "user_id" not in log_columns:
            connection.execute(text("ALTER TABLE model_call_logs ADD COLUMN user_id INTEGER NULL"))
            connection.execute(text("CREATE INDEX ix_model_call_logs_user_id ON model_call_logs (user_id)"))
        if "user_route_id" not in log_columns:
            connection.execute(text("ALTER TABLE model_call_logs ADD COLUMN user_route_id INTEGER NULL"))
            connection.execute(
                text("CREATE INDEX ix_model_call_logs_user_route_id ON model_call_logs (user_route_id)")
            )
        if "agent_type" not in log_columns:
            connection.execute(text("ALTER TABLE model_call_logs ADD COLUMN agent_type VARCHAR(50) NULL"))
            connection.execute(text("CREATE INDEX ix_model_call_logs_agent_type ON model_call_logs (agent_type)"))
        if "fallback_from_user_route_id" not in log_columns:
            connection.execute(
                text("ALTER TABLE model_call_logs ADD COLUMN fallback_from_user_route_id INTEGER NULL")
            )
        for column in (
            "estimated_input_tokens",
            "output_token_budget",
            "reserved_tokens",
            "released_tokens",
        ):
            if column not in log_columns:
                connection.execute(
                    text(f"ALTER TABLE model_call_logs ADD COLUMN {column} BIGINT NOT NULL DEFAULT 0")
                )
        if "fallback_reason" not in log_columns:
            connection.execute(text("ALTER TABLE model_call_logs ADD COLUMN fallback_reason VARCHAR(40) NULL"))
        connection.execute(
            text(
                "UPDATE model_call_logs SET user_id = "
                "(SELECT agent_tasks.requested_by FROM agent_tasks "
                "WHERE agent_tasks.id = model_call_logs.task_id) "
                "WHERE user_id IS NULL AND task_id IS NOT NULL"
            )
        )

    if "user_model_quotas" in tables:
        quota_columns = {column["name"] for column in inspector.get_columns("user_model_quotas")}
        if "hard_limit_enabled" not in quota_columns:
            connection.execute(
                text(
                    "ALTER TABLE user_model_quotas ADD COLUMN "
                    "hard_limit_enabled BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )

    if "repositories" in tables:
        repository_columns = {column["name"] for column in inspector.get_columns("repositories")}
        if "credential_username" not in repository_columns:
            connection.execute(text("ALTER TABLE repositories ADD COLUMN credential_username VARCHAR(255) NULL"))
        if "credential_ciphertext" not in repository_columns:
            connection.execute(text("ALTER TABLE repositories ADD COLUMN credential_ciphertext TEXT NULL"))

    if "requirements" in tables:
        requirement_columns = {column["name"] for column in inspector.get_columns("requirements")}
        if "testing_agent_version_id" not in requirement_columns:
            connection.execute(text("ALTER TABLE requirements ADD COLUMN testing_agent_version_id INTEGER NULL"))
        connection.execute(
            text(
                "UPDATE requirements SET stage = 'final_acceptance', run_status = 'waiting_human', "
                "version = version + 1 WHERE stage IN "
                "('test_case_generation', 'test_case_review', 'test_execution')"
            )
        )
    if "pipelines" in tables:
        connection.execute(
            text(
                "UPDATE pipelines SET current_stage = 'final_acceptance', run_status = 'waiting_human' "
                "WHERE current_stage IN ('test_case_generation', 'test_case_review', 'test_execution')"
            )
        )


async def seed_demo_data() -> None:
    async with async_session() as session:
        existing_tenants = list((await session.scalars(select(Tenant))).all())
        if existing_tenants:
            await session.execute(
                update(AgentDefinition)
                .where(AgentDefinition.role_type == "testing")
                .values(status="disabled", default_flag=False)
            )
            development_versions = list(
                (
                    await session.scalars(
                        select(AgentVersion)
                        .join(AgentDefinition, AgentDefinition.id == AgentVersion.agent_id)
                        .where(AgentDefinition.role_type == "development")
                    )
                ).all()
            )
            for version in development_versions:
                tool_policy = dict(version.tool_policy or {})
                if tool_policy.get("shell") == "allowlist":
                    tool_policy["shell"] = True
                    version.tool_policy = tool_policy
            await session.commit()
            return

        tenant = Tenant(name="demo")
        session.add(tenant)
        await session.flush()

        for username, role in (
            ("admin", "admin"),
            ("pm", "pm"),
            ("developer", "developer"),
            ("qa", "qa"),
        ):
            session.add(
                User(
                    tenant_id=tenant.id,
                    username=username,
                    email=f"{username}@dagent.local",
                    password_hash=hash_password(f"{username}123"),
                    roles=[role],
                )
            )

        requirement_agent = AgentDefinition(
            tenant_id=tenant.id,
            role_type="requirement_clarification",
            name="Requirement clarification - balanced",
            default_flag=True,
        )
        development_agent = AgentDefinition(
            tenant_id=tenant.id,
            role_type="development",
            name="Development - balanced",
            default_flag=True,
        )
        session.add_all([requirement_agent, development_agent])
        await session.flush()
        session.add_all(
            [
                AgentVersion(
                    agent_id=requirement_agent.id,
                    version=1,
                    style="balanced",
                    prompt_ref="builtin://requirement-clarification/v1",
                    skill_policy=["requirement-elicitation", "codebase-impact-analysis", "acceptance-criteria"],
                    tool_policy={"repository": "read_only", "shell": False},
                ),
                AgentVersion(
                    agent_id=development_agent.id,
                    version=1,
                    style="balanced",
                    prompt_ref="builtin://development/v1",
                    skill_policy=["implementation-planning", "code-change", "code-review", "test-design"],
                    tool_policy={"workspace": "requirement_scoped", "shell": True},
                ),
            ]
        )
        await session.commit()


async def close_db() -> None:
    await engine.dispose()
