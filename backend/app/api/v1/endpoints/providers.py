from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.providers.factory import SUPPORTED_LLM_PROVIDERS, ProviderFactory, create_llm_provider

router = APIRouter()


class ProviderTestRequest(BaseModel):
    provider: str
    model: str = Field(min_length=1, max_length=200)
    api_key: str | None = Field(default=None, exclude=True)
    base_url: str | None = None


class ProviderSwitchRequest(BaseModel):
    provider: str
    model: str = Field(min_length=1, max_length=200)
    api_key: str | None = Field(default=None)
    base_url: str | None = None


@router.get("/")
def active_provider():
    return {
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "base_url": settings.LLM_BASE_URL,
        "has_api_key": bool(settings.LLM_API_KEY),
        "supported_providers": sorted(SUPPORTED_LLM_PROVIDERS),
        "runtime_updates_supported": True,
    }


@router.post("/switch")
async def switch_provider(request: ProviderSwitchRequest):
    """Switch the active LLM provider at runtime (no restart required)."""
    try:
        new_provider = create_llm_provider(
            request.provider, request.model, request.api_key, request.base_url
        )
        # Test it first
        await new_provider.test_connection()
        # Commit to factory
        ProviderFactory.set_llm_provider(new_provider)
        # Update settings for health endpoint
        settings.LLM_PROVIDER = request.provider
        settings.LLM_MODEL = request.model
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Connection test failed: {exc}") from exc
    return {"success": True, "provider": request.provider, "model": request.model}


@router.post("/test")
async def test_provider(request: ProviderTestRequest):
    try:
        provider = create_llm_provider(request.provider, request.model, request.api_key, request.base_url)
        await provider.test_connection()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Provider connection test failed")
    return {"success": True, "provider": request.provider, "model": request.model}