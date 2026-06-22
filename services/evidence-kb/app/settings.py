from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_KEY: str | None = None
    DATABASE_URL: str | None = None
    DB_SCHEMA: str = "evidence_kb"
    STORAGE_BACKEND: str = "memory"
    EMBEDDING_DIMENSIONS: int = 1536
    EMBEDDING_SERVICE_URL: str | None = None
    EMBEDDING_SERVICE_API_KEY: str | None = None
    CHUNK_SIZE_CHARS: int = 1200
    CHUNK_OVERLAP_CHARS: int = 160
    RRF_K: int = 60
    DEFAULT_TOP_K: int = 12

    # S3 / R2 Configuration
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    S3_BUCKET_NAME: str | None = None
    S3_REGION: str = "auto"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
