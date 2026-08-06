from httpx import AsyncClient

from dagent.api.v1 import auth
from dagent.config import get_settings


async def test_quick_login_is_disabled_by_default(client: AsyncClient):
    response = await client.post("/api/v1/auth/quick-login", json={"username": "pm"})

    assert response.status_code == 403


async def test_quick_login_allows_the_four_demo_accounts(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(auth, "get_settings", lambda: get_settings().model_copy(update={"QUICK_LOGIN_ENABLED": True}))

    for username in ("admin", "pm", "developer", "qa"):
        response = await client.post("/api/v1/auth/quick-login", json={"username": username})

        assert response.status_code == 200
        assert response.json()["data"]["user"]["username"] == username


async def test_quick_login_rejects_other_accounts(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(auth, "get_settings", lambda: get_settings().model_copy(update={"QUICK_LOGIN_ENABLED": True}))

    response = await client.post("/api/v1/auth/quick-login", json={"username": "unknown"})

    assert response.status_code == 403
