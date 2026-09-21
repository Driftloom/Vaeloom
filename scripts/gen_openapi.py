import os
import sys
from pathlib import Path
import yaml

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-ci-only-32-chars-long!!")
os.environ.setdefault("ENCRYPTION_KEY", "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///./dev.db")
os.environ.setdefault("LLM_API_KEY", "mock-key")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "apps" / "api" / "src"))

from api.main import app

spec = app.openapi()

# ── Contract hardening (spec-only; no runtime change) ─────────────────────
# 1. Bearer JWT security scheme. Auth is enforced by custom middleware
#    (middleware/auth.py parses `Authorization: Bearer <jwt>` manually), so
#    FastAPI never auto-generates `components/securitySchemes`. Declare it
#    here so generated clients know how to authenticate. No global
#    `security:` requirement is set: public paths (/health, /csrf-token,
#    /api/v1/auth/*, /docs, /openapi.json) need no token.
components = spec.setdefault("components", {})
schemes = components.setdefault("securitySchemes", {})
schemes.setdefault(
    "BearerAuth",
    {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": (
            "JWT access token from POST /api/v1/auth/login. "
            "Send as `Authorization: Bearer <token>`."
        ),
    },
)

# 2. Global 429 responses. RateLimitMiddleware (middleware/rate_limit.py)
#    returns 429 + `Retry-After` for EVERY rate-limited request, with body
#    `{"detail": "<reason>"}` (it returns JSONResponse directly, bypassing
#    the unified exception envelope). Success responses additionally carry
#    X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset.
#    Mirror the middleware's SKIP_PATHS exactly: those paths are never
#    rate-limited, so they get no 429. NOTE /csrf-token and /metrics ARE
#    rate-limited by design (zero-trust), as is /health/startup (exact-match
#    skip covers only /health and /health/ready) — they keep the 429.
RATE_LIMIT_SKIP_PATHS = frozenset(
    {"/health", "/health/ready", "/docs", "/openapi.json", "/redoc"}
)
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}

RATE_LIMIT_429_RESPONSE = {
    "description": (
        "Too Many Requests — rate limit exceeded (sliding window). "
        "See docs/backend/Rate-Limiting.md. Retry after the seconds "
        "given in the `Retry-After` header."
    ),
    "headers": {
        "Retry-After": {
            "description": "Seconds to wait before retrying.",
            "schema": {"type": "integer", "minimum": 1},
        },
        "X-RateLimit-Limit": {
            "description": "Configured request quota for the window.",
            "schema": {"type": "integer"},
        },
        "X-RateLimit-Remaining": {
            "description": "Requests remaining in the current window.",
            "schema": {"type": "integer"},
        },
        "X-RateLimit-Reset": {
            "description": "Unix timestamp when the window resets.",
            "schema": {"type": "integer"},
        },
    },
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "properties": {"detail": {"type": "string"}},
                "required": ["detail"],
            },
            "example": {"detail": "Rate limit exceeded"},
        }
    },
}

for path, path_item in spec.get("paths", {}).items():
    if path in RATE_LIMIT_SKIP_PATHS:
        continue
    if not isinstance(path_item, dict):
        continue
    for method, operation in path_item.items():
        if method.lower() not in HTTP_METHODS:
            continue
        if not isinstance(operation, dict):
            continue
        responses = operation.setdefault("responses", {})
        responses.setdefault("429", RATE_LIMIT_429_RESPONSE)
out_path = REPO_ROOT / "specs" / "api" / "openapi.yaml"
out_path.parent.mkdir(parents=True, exist_ok=True)

with open(out_path, "w", encoding="utf-8") as f:
    yaml.dump(spec, f, sort_keys=False, allow_unicode=True)

# Also maintain backward-compatible mirror at docs/backend/openapi.yaml
mirror_path = REPO_ROOT / "docs" / "backend" / "openapi.yaml"
mirror_path.parent.mkdir(parents=True, exist_ok=True)
with open(mirror_path, "w", encoding="utf-8") as f:
    yaml.dump(spec, f, sort_keys=False, allow_unicode=True)

print(f"Generated {out_path} and {mirror_path} with {len(spec.get('paths', {}))} paths.")
