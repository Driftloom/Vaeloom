from contextvars import ContextVar

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="")
user_id_var: ContextVar[str] = ContextVar("user_id", default="")

_REDACT_KEYS = frozenset({
    "password", "passwordhash", "password_hash",
    "token", "access_token", "accesstoken", "refresh_token", "refreshtoken",
    "authorization", "cookie", "set-cookie", "bearer", "jwt",
    "api_key", "apikey", "api-key", "secret", "client_secret", "client_id",
    "oauth", "oauth_token", "credential", "credentials", "private_key", "session", "sso",
})


def _redact(obj):
    if isinstance(obj, dict):
        return {
            k: "[REDACTED]" if k.lower() in _REDACT_KEYS else _redact(v)
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return [_redact(item) for item in obj]
    return obj
