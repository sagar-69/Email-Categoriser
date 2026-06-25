"""
Request logging middleware for FastAPI.

Logs every HTTP request and response with method, path, status code,
and processing time using the existing Loguru logger.
"""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from loguru import logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs all incoming HTTP requests and their responses.

    Log format:
        → GET /api/emails — 200 OK — 45ms
    """

    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        method = request.method
        path = request.url.path
        query = str(request.url.query) if request.url.query else ""
        client = request.client.host if request.client else "unknown"

        # Log incoming request
        logger.info(
            "→ {} {} {} from {}",
            method,
            path,
            f"?{query}" if query else "",
            client,
        )

        try:
            response = await call_next(request)
            process_time_ms = (time.perf_counter() - start_time) * 1000

            # Log response
            logger.info(
                "← {} {} — {} — {:.1f}ms",
                method,
                path,
                response.status_code,
                process_time_ms,
            )

            # Add timing header for debugging
            response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.1f}"
            return response

        except Exception as exc:
            process_time_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                "✗ {} {} — ERROR — {:.1f}ms — {}",
                method,
                path,
                process_time_ms,
                str(exc),
            )
            raise
