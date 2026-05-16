from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from typing import Callable, Awaitable

# Routes that do not require authentication.
# Format: "METHOD /path"
_PUBLIC_EXACT: frozenset[str] = frozenset({
    # Auth flow
    "POST /auth/login",
    "POST /auth/register",
    "POST /auth/refresh",
    # Public read endpoints
    "GET /",
    "GET /cities/",
    "GET /cities",
    "GET /subscriptions/plans",
    "GET /permissions/",
    "GET /permissions",
    "GET /roles/",
    "GET /roles",
    "GET /users/",
    "GET /users",
    # LGU invite verification
    "GET /users/lgu/verify-invitation",
})

# Path prefixes always public regardless of method.
_PUBLIC_PREFIXES: tuple[str, ...] = (
    "/docs",
    "/redoc",
    "/openapi",
    "/files/",
    "/cities/",   # city sub-resources (zoning, establishments, alerts) have their own auth deps
)


async def auth_enforcement_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """
    Gate middleware: every non-public request must carry:
      - Authorization: Bearer <access_token>

    Uses the plain @app.middleware("http") form (not BaseHTTPMiddleware) to avoid
    Starlette's exception-propagation issue where 500s bypass CORSMiddleware.
    """
    # OPTIONS = CORS preflight — always pass through
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    method = request.method
    key = f"{method} {path}"

    if key in _PUBLIC_EXACT or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    parts = auth_header.strip().split()
    has_bearer = len(parts) == 2 and parts[0].lower() == "bearer"

    if not has_bearer:
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)

    return await call_next(request)