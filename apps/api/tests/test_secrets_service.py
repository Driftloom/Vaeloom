import pytest
from api.services.secrets_service import SecretsService


@pytest.fixture
def secrets_service(monkeypatch):
    monkeypatch.setenv("TEST_KEY", "test_value")
    monkeypatch.setenv("ANOTHER_KEY", "another_value")
    return SecretsService()


def test_get_existing_key(secrets_service):
    assert secrets_service.get("TEST_KEY") == "test_value"


def test_get_missing_key(secrets_service):
    assert secrets_service.get("NONEXISTENT") is None


def test_get_with_default(secrets_service):
    assert secrets_service.get("NONEXISTENT", "default_val") == "default_val"


def test_get_or_throw_existing(secrets_service):
    assert secrets_service.get_or_throw("TEST_KEY") == "test_value"


def test_get_or_throw_missing(secrets_service):
    with pytest.raises(ValueError, match="not configured"):
        secrets_service.get_or_throw("NONEXISTENT")


def test_has_existing_key(secrets_service):
    assert secrets_service.has("TEST_KEY") is True


def test_has_missing_key(secrets_service):
    assert secrets_service.has("NONEXISTENT") is False


def test_list_keys(secrets_service):
    keys = secrets_service.list_keys()
    assert "TEST_KEY" in keys
    assert "ANOTHER_KEY" in keys
