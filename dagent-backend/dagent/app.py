from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from dagent.api.errors import register_error_handlers
from dagent.api.v1 import api_router
from dagent.config import get_settings
from dagent.db.session import close_db, init_db, seed_demo_data
from dagent.services.agent_runtime import AgentRuntime


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.AUTO_CREATE_SCHEMA:
        await init_db()
    if settings.SEED_DEMO_DATA:
        await seed_demo_data()
    runtime = AgentRuntime(settings)
    await runtime.start()
    app.state.agent_runtime = runtime
    yield
    await runtime.stop()
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def trace_requests(request: Request, call_next):
        trace_id = request.headers.get("X-Trace-Id") or uuid4().hex
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id
        return response

    register_error_handlers(app)

    # API routes
    app.include_router(api_router, prefix="/api/v1")

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok", "service": settings.APP_NAME}

    return app
