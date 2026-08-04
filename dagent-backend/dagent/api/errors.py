from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class DagentError(Exception):
    def __init__(self, status_code: int, code: int, message: str, data: Any = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.data = data
        super().__init__(message)


class NotFoundError(DagentError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(404, 40400, message)


class PermissionDeniedError(DagentError):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(403, 40300, message)


class ConflictError(DagentError):
    def __init__(self, message: str):
        super().__init__(409, 40900, message)


class InvalidStateError(DagentError):
    def __init__(self, message: str):
        super().__init__(409, 40901, message)


class ExternalDependencyError(DagentError):
    def __init__(self, message: str):
        super().__init__(503, 50300, message)


SENSITIVE_FIELDS = {"password", "token", "secret", "api_key", "access_token"}


def _safe_validation_errors(exc: RequestValidationError) -> list[dict[str, Any]]:
    errors = cast(list[dict[str, Any]], jsonable_encoder(exc.errors()))
    for error in errors:
        location = {str(part).lower() for part in error.get("loc", [])}
        if location.intersection(SENSITIVE_FIELDS) and "input" in error:
            error["input"] = "<redacted>"
    return errors


def _response(status_code: int, code: int, message: str, data: Any = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"code": code, "message": message, "data": data})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DagentError)
    async def handle_dagent_error(_: Request, exc: DagentError) -> JSONResponse:
        return _response(exc.status_code, exc.code, exc.message, exc.data)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _response(
            422,
            42200,
            "Request validation failed",
            {"errors": _safe_validation_errors(exc)},
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = 40100 if exc.status_code == 401 else exc.status_code * 100
        return _response(exc.status_code, code, str(exc.detail))
