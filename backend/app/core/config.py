from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "rag-orchestrator"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    POSTGRES_USER: str = "raguser"
    POSTGRES_PASSWORD: str = "ragpass"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "ragdb"

    VECTOR_TOP_K: int = Field(default=20, ge=1, le=200)
    KEYWORD_TOP_K: int = Field(default=20, ge=1, le=200)
    RRF_K: int = Field(default=60, ge=1, le=1000)
    FINAL_TOP_K: int = Field(default=5, ge=1, le=100)
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSION: int = Field(default=384, ge=1)

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()