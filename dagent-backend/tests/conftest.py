import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["AUTO_CREATE_SCHEMA"] = "false"
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["JWT_SECRET_KEY"] = "test-only-secret"
os.environ["AGENT_CALLBACK_TOKEN"] = "test-agent-token"
os.environ["GIT_CREDENTIAL_ENCRYPTION_KEY"] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from dagent.app import create_app
from dagent.db.session import close_db, engine, init_db, seed_demo_data
from dagent.models import Base


@pytest_asyncio.fixture(scope="session", autouse=True)
async def database():
    await init_db()
    await seed_demo_data()
    yield
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await close_db()


@pytest.fixture
def app():
    return create_app()


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client


@pytest_asyncio.fixture
async def users(client):
    result = {}
    for username in ("admin", "pm", "developer", "qa"):
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": f"{username}123"},
        )
        assert response.status_code == 200
        data = response.json()["data"]
        result[username] = {
            "id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"},
        }
    return result
