import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.factory import create_llm_provider, validate_endpoint


def test_factory_rejects_unsupported_and_missing_credentials():
    with pytest.raises(ValueError, match="Unsupported"):
        create_llm_provider("unknown", "model")
    with pytest.raises(ValueError, match="requires an API key"):
        create_llm_provider("groq", "model")


def test_custom_endpoint_blocks_private_addresses_when_enabled():
    with pytest.raises(ValueError, match="Private or local"):
        validate_endpoint("http://127.0.0.1:8000/v1")
    assert validate_endpoint("http://127.0.0.1:8000/v1", allow_private=True).startswith("http://127")


def test_provider_status_hides_credentials(monkeypatch):
    monkeypatch.setattr("app.api.v1.endpoints.providers.settings.LLM_API_KEY", "super-secret")
    with TestClient(app) as client:
        response = client.get("/api/v1/providers/")
    assert response.status_code == 200
    assert response.json()["has_api_key"] is True
    assert "api_key" not in response.json()
    assert "super-secret" not in response.text


def test_connection_test_uses_request_only_credentials(monkeypatch):
    class Provider:
        async def test_connection(self):
            return None

    monkeypatch.setattr("app.api.v1.endpoints.providers.create_llm_provider", lambda *args: Provider())
    with TestClient(app) as client:
        response = client.post("/api/v1/providers/test", json={"provider": "groq", "model": "test", "api_key": "temporary"})
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "temporary" not in response.text