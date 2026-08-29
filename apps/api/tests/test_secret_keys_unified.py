"""F-11 regression: secret-key detection must have a single source of truth.

logging redaction, Temporal workflow-history validation, and graph-state validation
previously forked divergent copies of the secret-key set (finding F-11). This test
fails if any of them re-drifts from api.temporal.validation.SECRET_KEYS.
"""

import pytest

from api.logging import _REDACT_KEYS
from api.graph.state import SECRET_KEYS as GRAPH_SECRET_KEYS, FORBIDDEN_GRAPH_KEYS
from api.temporal.validation import SECRET_KEYS as CANONICAL_SECRET_KEYS


def test_canonical_is_single_source_of_truth():
    # The canonical set is the one defined in temporal.validation.
    assert isinstance(CANONICAL_SECRET_KEYS, frozenset)
    assert len(CANONICAL_SECRET_KEYS) >= 25


def test_logging_uses_canonical_set():
    # Redaction must not fork a divergent copy.
    assert _REDACT_KEYS == CANONICAL_SECRET_KEYS


def test_graph_state_uses_canonical_set():
    assert GRAPH_SECRET_KEYS == CANONICAL_SECRET_KEYS
    # Graph state is at least as strict as the canonical set.
    assert FORBIDDEN_GRAPH_KEYS >= CANONICAL_SECRET_KEYS


def test_canonical_covers_expected_keys():
    expected = {
        "password", "token", "access_token", "refresh_token", "secret",
        "authorization", "bearer", "jwt", "api_key", "apikey", "api-key",
        "client_secret", "oauth_token", "credential", "credentials",
        "private_key", "cookie", "session", "sso", "x-api-key",
    }
    missing = expected - CANONICAL_SECRET_KEYS
    assert not missing, f"canonical set missing keys: {sorted(missing)}"


@pytest.mark.parametrize("payload", [
    {"api_key": "x"},
    {"authorization": "Bearer y"},
    {"client_secret": "z"},
    {"password": "p", "nested": {"jwt": "t"}},
])
def test_canonical_detects_secrets(payload):
    from api.temporal.validation import validate_no_secrets

    with pytest.raises(ValueError):
        validate_no_secrets(payload)
