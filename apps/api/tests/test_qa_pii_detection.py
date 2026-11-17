"""QA PII detection: card-shaped numbers, not every long digit run.

Regression for the REACT-E2E-14 flake: the previous pattern
``\\b(?:\\d[ -]*?){13,16}\\b`` flagged any 13-16 digit run, including a
workspace document UUID whose trailing segments happened to be all digits
(e.g. ``...-1234-567890123456``). QA then rejected *every* retry of that
run, and the outer loop terminated it as a "repeated action cycle" instead
of answering. Random UUIDs are ~0.1% card-shaped, and the concurrency test
creates one document UUID per workspace (31 per test), so roughly one CI
run in thirty failed on data alone.
"""
from __future__ import annotations

import json
import random
import uuid

import pytest

from api.agents.qa_agent.handler import QAAgent, _find_credit_card


def _payload(*texts: str) -> dict:
    return {
        "agent_name": "react_e2e",
        "action": "suggest",
        "confidence": 0.9,
        "result": {
            "summary": texts[0] if texts else "OK",
            "details": texts[1] if len(texts) > 1 else None,
            "proposals": [],
            "questions": [],
        },
    }


# A UUID whose fourth and fifth segments are all digits: 16 digits across
# a hyphen, i.e. exactly what the old pattern accepted as a card number.
CARD_SHAPED_UUID = "0c82f82d-0c25-45c9-1234-567890123456"


@pytest.mark.asyncio
async def test_uuid_with_numeric_tail_is_not_pii():
    res = await QAAgent().validate(_payload(f"Private ledger {CARD_SHAPED_UUID}"))
    assert res.decision == "approved", res.issues
    assert not any("PII" in issue for issue in res.issues)


@pytest.mark.asyncio
async def test_nil_uuid_is_not_pii():
    res = await QAAgent().validate(
        _payload("workspace 00000000-0000-0000-0000-000000000000")
    )
    assert res.decision == "approved", res.issues


def test_no_random_uuid_is_ever_a_card():
    rng = random.Random(20261117)
    for _ in range(2000):
        candidate = str(uuid.UUID(int=rng.getrandbits(128)))
        assert _find_credit_card(candidate) is None, candidate


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "text",
    [
        "Card on file: 4111 1111 1111 1111",
        "Card on file: 4111-1111-1111-1111",
        "Charge 4111111111111111 today",
        "Amex 3782 822463 10005 on file",
    ],
)
async def test_card_numbers_are_still_rejected(text):
    res = await QAAgent().validate(_payload(text))
    assert res.decision == "rejected"
    assert any("credit-card" in issue for issue in res.issues), res.issues


@pytest.mark.asyncio
async def test_luhn_invalid_digit_run_is_not_pii():
    # 16 digits, no card checksum: an order id, not a card.
    res = await QAAgent().validate(_payload("order 1234567890123456"))
    assert res.decision == "approved", res.issues


def test_short_epoch_like_run_needs_card_context():
    # Luhn-valid 13-digit epoch (2025-11-17T18:56:07Z in ms): ambiguous on
    # its own, so it must not flag without card context.
    epoch = "1763405767031"
    assert _find_credit_card(epoch) is None
    assert _find_credit_card(f"charged to card at {epoch}") == epoch


def test_uuid_masking_is_structural():
    # The UUID is removed before candidate scanning, so a card-shaped tail
    # can never be recovered by scanning the serialized payload.
    payload = json.dumps(_payload(f"doc {CARD_SHAPED_UUID}"))
    assert CARD_SHAPED_UUID.split("-")[-2] in payload  # digits still present
    assert _find_credit_card(payload) is None
