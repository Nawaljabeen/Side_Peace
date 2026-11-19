"""Turns every failure into the contract's error body: {"error": code, "message": safe text}.

Messages are fixed strings. They never contain stack traces, paths, SQL, submitted values
or API keys; the details go to the log instead.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from errors import (
    ProviderBadResponseError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    StorageError,
)

logger = logging.getLogger("sidepeace")

# exception type -> (HTTP status, machine code, safe message)
_KNOWN_ERRORS = {
    StorageError: (500, "storage_error", "Could not save or load your data. Please try again."),
    ProviderTimeoutError: (504, "provider_timeout", "The AI service took too long. Please try again."),
    ProviderRateLimitError: (429, "provider_rate_limit", "The AI service is busy. Please try again in a moment."),
    ProviderBadResponseError: (
        502,
        "provider_bad_response",
        "The AI service gave an unusable answer. Please try again.",
    ),
}


# routing failures raised by the framework itself: HTTP status -> (machine code, safe message)
_HTTP_ERRORS = {
    404: ("not_found", "That address does not exist."),
    405: ("method_not_allowed", "That method is not allowed here."),
}


def _error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "message": message})


def _validation_message(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "The request is not valid."
    first = errors[0]
    field = ".".join(str(part) for part in first["loc"] if part != "body")
    return f"{field}: {first['msg']}" if field else str(first["msg"])


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def on_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.info("validation error path=%s", request.url.path)
        return _error_response(422, "validation_error", _validation_message(exc))

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code, message = _HTTP_ERRORS.get(exc.status_code, ("http_error", "The request could not be handled."))
        return _error_response(exc.status_code, code, message)

    def make_handler(status: int, code: str, message: str):
        async def handler(request: Request, exc: Exception) -> JSONResponse:
            logger.warning("%s path=%s detail=%s", code, request.url.path, exc)
            return _error_response(status, code, message)

        return handler

    for exc_type, (status, code, message) in _KNOWN_ERRORS.items():
        app.add_exception_handler(exc_type, make_handler(status, code, message))

    # Last resort for bugs we did not predict: log everything, tell the client nothing.
    @app.exception_handler(Exception)
    async def on_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unexpected error path=%s", request.url.path, exc_info=exc)
        return _error_response(500, "internal_error", "Something went wrong. Please try again.")