import os
import time

import pytest

from api.infrastructure.secrets import (
    EnvSecretManager,
    InfisicalSecretManager,
    SecretManager,
    get_secret_manager,
    get_secret,
    _secret_manager,
)


class TestEnvSecretManager:
    def test_returns_env_var_value(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("VAELOOM_TEST_KEY", "test-value")
        mgr = EnvSecretManager()
        assert mgr.get_secret("VAELOOM_TEST_KEY") == "test-value"

    def test_returns_none_for_missing_key(self):
        mgr = EnvSecretManager()
        assert mgr.get_secret("NONEXISTENT_VAR_XYZ") is None

    def test_uses_os_environ_directly(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("MY_CUSTOM_KEY", raising=False)
        mgr = EnvSecretManager()
        assert mgr.get_secret("MY_CUSTOM_KEY") is None
        monkeypatch.setenv("MY_CUSTOM_KEY", "set-later")
        assert mgr.get_secret("MY_CUSTOM_KEY") == "set-later"

    def test_empty_env_var_returns_empty_string(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("EMPTY_KEY", "")
        mgr = EnvSecretManager()
        assert mgr.get_secret("EMPTY_KEY") == ""


class FakeInfisicalClient:
    def __init__(self, secrets: dict | None = None):
        self._secrets = secrets or {}
        self.call_count = 0

    def get_secret(self, key: str) -> str | None:
        self.call_count += 1
        return self._secrets.get(key)


class TestInfisicalSecretManager:
    def test_returns_cached_secret(self):
        client = FakeInfisicalClient({"MY_KEY": "my-value"})
        mgr = InfisicalSecretManager("dummy-id", "dummy-secret")
        mgr._client = client

        first = mgr.get_secret("MY_KEY")
        second = mgr.get_secret("MY_KEY")

        assert first == "my-value"
        assert second == "my-value"
        assert client.call_count == 1

    def test_cache_expires_after_ttl(self):
        client = FakeInfisicalClient({"MY_KEY": "my-value"})
        mgr = InfisicalSecretManager("dummy-id", "dummy-secret")
        mgr._client = client
        mgr._ttl = 0.01

        mgr.get_secret("MY_KEY")
        time.sleep(0.02)
        mgr.get_secret("MY_KEY")

        assert client.call_count == 2

    def test_returns_none_for_missing_secret(self):
        client = FakeInfisicalClient({})
        mgr = InfisicalSecretManager("dummy-id", "dummy-secret")
        mgr._client = client

        assert mgr.get_secret("NONEXISTENT") is None

    def test_does_not_cache_none(self):
        client = FakeInfisicalClient({"MY_KEY": None})
        mgr = InfisicalSecretManager("dummy-id", "dummy-secret")
        mgr._client = client

        assert mgr.get_secret("MY_KEY") is None
        assert client.call_count == 1

        assert mgr.get_secret("MY_KEY") is None
        assert client.call_count == 2

        mgr._client._secrets["MY_KEY"] = "v1"
        assert mgr.get_secret("MY_KEY") == "v1"
        assert client.call_count == 3

    def test_clear_cache_forces_refetch(self):
        client = FakeInfisicalClient({"MY_KEY": "my-value"})
        mgr = InfisicalSecretManager("dummy-id", "dummy-secret")
        mgr._client = client

        mgr.get_secret("MY_KEY")
        mgr.clear_cache()
        mgr.get_secret("MY_KEY")

        assert client.call_count == 2


class TestGetSecretManager:
    def test_returns_env_manager_when_infisical_disabled(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("INFISICAL_ENABLED", raising=False)
        mgr = get_secret_manager()
        assert isinstance(mgr, EnvSecretManager)

    def test_returns_env_manager_when_infisical_not_true(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("INFISICAL_ENABLED", "false")
        mgr = get_secret_manager()
        assert isinstance(mgr, EnvSecretManager)

    def test_returns_env_when_enabled_but_no_credentials(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("INFISICAL_ENABLED", "true")
        monkeypatch.delenv("INFISICAL_CLIENT_ID", raising=False)
        monkeypatch.delenv("INFISICAL_CLIENT_SECRET", raising=False)
        mgr = get_secret_manager()
        assert isinstance(mgr, EnvSecretManager)

    def test_returns_env_when_empty_credentials(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("INFISICAL_ENABLED", "true")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "")
        mgr = get_secret_manager()
        assert isinstance(mgr, EnvSecretManager)

    def test_returns_infisical_when_fully_configured(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("INFISICAL_ENABLED", "true")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "my-client-id")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "my-client-secret")
        mgr = get_secret_manager()
        assert isinstance(mgr, InfisicalSecretManager)

    def test_returns_env_when_missing_client_secret(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("INFISICAL_ENABLED", "true")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "my-client-id")
        monkeypatch.delenv("INFISICAL_CLIENT_SECRET", raising=False)
        mgr = get_secret_manager()
        assert isinstance(mgr, EnvSecretManager)

    @pytest.mark.parametrize("val", ["1", "true", "TRUE", "yes", "YES"])
    def test_truthy_values_enable_infisical(self, monkeypatch: pytest.MonkeyPatch, val: str):
        monkeypatch.setenv("INFISICAL_ENABLED", val)
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "cid")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "cs")
        mgr = get_secret_manager()
        assert isinstance(mgr, InfisicalSecretManager)


class TestGetSecret:
    def teardown_method(self) -> None:
        import api.infrastructure.secrets as m
        m._secret_manager = None

    def test_get_secret_uses_env_manager_by_default(self, monkeypatch: pytest.MonkeyPatch):
        import api.infrastructure.secrets as m
        m._secret_manager = None
        monkeypatch.setenv("FALLBACK_KEY", "fallback-value")
        assert get_secret("FALLBACK_KEY") == "fallback-value"

    def test_get_secret_returns_none_for_missing(self):
        import api.infrastructure.secrets as m
        m._secret_manager = None
        assert get_secret("DOES_NOT_EXIST_AT_ALL") is None


class TestSecretManagerProtocol:
    def test_env_manager_is_instance(self):
        assert isinstance(EnvSecretManager(), SecretManager)

    def test_infisical_manager_is_instance(self):
        assert isinstance(InfisicalSecretManager("dummy-id", "dummy-secret"), SecretManager)

    def test_can_use_polymorphically(self):
        managers: list[SecretManager] = [EnvSecretManager(), InfisicalSecretManager("dummy-id", "dummy-secret")]
        for mgr in managers:
            assert hasattr(mgr, "get_secret")
