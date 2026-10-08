from app.core.config import settings

def test_config_defaults():
    assert settings.PROJECT_NAME == "rag-orchestrator"
    assert settings.API_V1_STR == "/api/v1"
    assert "postgresql://" in settings.SQLALCHEMY_DATABASE_URI
