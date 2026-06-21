import secrets
from fastapi import Header, HTTPException
from app.settings import get_settings


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = get_settings().API_KEY
    if expected:
        if not x_api_key or not secrets.compare_digest(x_api_key, expected):
            raise HTTPException(status_code=401, detail="Invalid API key")
