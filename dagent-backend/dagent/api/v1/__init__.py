from fastapi import APIRouter

from dagent.api.v1.agent_tasks import router as agent_tasks_router
from dagent.api.v1.agents import router as agents_router
from dagent.api.v1.audit import router as audit_router
from dagent.api.v1.auth import router as auth_router
from dagent.api.v1.dashboard import router as dashboard_router
from dagent.api.v1.model_gateway import router as model_gateway_router
from dagent.api.v1.model_proxy import router as model_proxy_router
from dagent.api.v1.projects import router as projects_router
from dagent.api.v1.repositories import router as repositories_router
from dagent.api.v1.requirements import router as requirements_router
from dagent.api.v1.user_model_gateway import router as user_model_gateway_router
from dagent.api.v1.users import router as users_router
from dagent.api.v1.workspaces import router as workspaces_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(model_gateway_router, tags=["model-gateway"])
api_router.include_router(user_model_gateway_router, tags=["model-gateway"])
api_router.include_router(model_proxy_router, tags=["model-proxy"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(repositories_router, prefix="/repositories", tags=["repositories"])
api_router.include_router(requirements_router, prefix="/requirements", tags=["requirements"])
api_router.include_router(agent_tasks_router, tags=["agent-tasks"])
api_router.include_router(agents_router, tags=["agents"])
api_router.include_router(audit_router, tags=["audit"])
api_router.include_router(workspaces_router, tags=["git-workspaces"])
