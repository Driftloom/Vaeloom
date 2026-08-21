import os
import time
from abc import ABC, abstractmethod


class SecretManager(ABC):
    @abstractmethod
    def get_secret(self, key: str) -> str | None: ...


class EnvSecretManager(SecretManager):
    def get_secret(self, key: str) -> str | None:
        return os.environ.get(key)


class InfisicalClient:
    def __init__(self, client_id: str, client_secret: str, site_url: str | None = None):
        try:
            from infisical_client import ClientSettings
            from infisical_client import InfisicalClient as _InfisicalClient

            settings = ClientSettings(client_id=client_id, client_secret=client_secret)
            if site_url:
                settings.site_url = site_url
            self._client = _InfisicalClient(settings=settings)
        except ImportError:
            self._client = None

    def get_secret(self, key: str) -> str | None:
        if self._client is None:
            return None
        try:
            from infisical_client import GetSecretOptions

            secret = self._client.get_secret(
                GetSecretOptions(secret_name=key),
            )
            return secret.secret_value if secret else None
        except Exception:
            return None


class InfisicalSecretManager(SecretManager):
    def __init__(self, client_id: str, client_secret: str, site_url: str | None = None, client: InfisicalClient | None = None):
        self._client = client or InfisicalClient(client_id, client_secret, site_url)
        self._cache: dict[str, tuple[str, float]] = {}
        self._ttl: float = 300.0

    def get_secret(self, key: str) -> str | None:
        now = time.monotonic()
        if key in self._cache:
            value, expiry = self._cache[key]
            if now < expiry:
                return value
            del self._cache[key]
        value = self._client.get_secret(key)
        if value is not None:
            self._cache[key] = (value, now + self._ttl)
        return value

    def clear_cache(self) -> None:
        self._cache.clear()


def get_secret_manager() -> SecretManager:
    if os.environ.get("INFISICAL_ENABLED", "").lower() in ("1", "true", "yes"):
        client_id = os.environ.get("INFISICAL_CLIENT_ID", "")
        client_secret = os.environ.get("INFISICAL_CLIENT_SECRET", "")
        if client_id and client_secret:
            site_url = os.environ.get("INFISICAL_SITE_URL")
            return InfisicalSecretManager(client_id, client_secret, site_url)
    return EnvSecretManager()


_secret_manager: SecretManager | None = None


def get_secret(key: str) -> str | None:
    global _secret_manager
    if _secret_manager is None:
        _secret_manager = get_secret_manager()
    return _secret_manager.get_secret(key)
