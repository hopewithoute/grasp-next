import logging
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("evidence_kb")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            duration_ms = round((time.monotonic() - start) * 1000)
            logger.info(
                "request_completed",
                extra={
                    "method": method,
                    "path": path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                },
            )
            response.headers["X-Request-Duration-Ms"] = str(duration_ms)
            return response
        except Exception as exc:
            duration_ms = round((time.monotonic() - start) * 1000)
            logger.error(
                "request_failed",
                extra={
                    "method": method,
                    "path": path,
                    "duration_ms": duration_ms,
                    "error": str(exc),
                },
            )
            raise
