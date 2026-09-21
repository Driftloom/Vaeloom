"""Re-export fixtures for adversarial tests."""
from tests.integration.module05.conftest import authenticated_context, make_jwt

__all__ = ["authenticated_context", "make_jwt"]
