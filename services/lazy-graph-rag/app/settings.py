from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    LGS_DATABASE_URL: Optional[str] = None
    LGS_API_KEY: Optional[str] = None
    GLINER_MODEL: str = "urchade/gliner_medium-v2.1"
    TERM_EXTRACTOR_BASE_URL: Optional[str] = None
    TERM_EXTRACTOR_API_KEY: Optional[str] = None
    TERM_EXTRACTOR_THRESHOLD: float = 0.5
    TERM_EXTRACTOR_LABELS: str = "concept,topic,technology,tool,framework,method,process,principle,metric,organization,person,location"
    EMBEDDING_BASE_URL: Optional[str] = None
    EMBEDDING_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "Qwen/Qwen3-Embedding-0.6B"
    EMBEDDING_MODEL_PATH: Optional[str] = None
    EMBEDDING_DIMENSIONS: int = 1024
    LGS_CHUNK_TARGET_TOKENS: int = 512
    LGS_CHUNK_OVERLAP_TOKENS: int = 64
    LGS_CHUNK_MIN_TOKENS: int = 80

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

def get_settings() -> Settings:
    return Settings()
