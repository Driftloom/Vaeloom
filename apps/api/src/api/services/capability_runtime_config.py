"""Workspace capability runtime configuration — the seam that makes an
operator's Agents-UI setting actually reach the agent runtime.

Why this module exists
----------------------
The Agents UI writes ``config.max_react_rounds`` onto a ``workspace_capabilities``
row with ``category="agent"``. Until now nothing read it: the loop computed its
ReAct round budget from ``getattr(card, "max_react_rounds")`` — the *agent card*,
a different object with a different lifecycle — and then from the global
setting. The stored value was honoured by nothing, which is the same
"the notebook says it is configurable but the value goes nowhere" dishonesty
this module removes.

Precedence (most specific first)
--------------------------------
1. ``workspace_capabilities`` row ``config.max_react_rounds`` — an operator's
   per-workspace, per-agent decision. The most specific answer wins.
2. ``card.max_react_rounds`` — the code-defined agent contract.
3. ``settings.agent_max_react_rounds`` — the deployment default.
4. :data:`DEFAULT_MAX_REACT_ROUNDS` — the compiled-in default.

The returned ``source`` is part of the contract, not decoration. "Why is my agent
stopping at 3 rounds" is unanswerable from the number alone; the caller logs it
so the deciding layer is visible in the run log.

Honesty rules
-------------
A stored value is only honoured when it is a real positive integer. Every other
shape of input is either rejected (fall through to the next source) or clamped
(minimum / maximum), and **both** outcomes are logged with the offending value
and the layer it came from. A silently clamped value is indistinguishable from
a setting that was never applied — which is the exact failure this module exists
to eliminate.

Rejected, with the trap named:

``True`` / ``False``
    ``bool`` is a subclass of ``int`` in Python, so ``int(True) == 1`` and
    ``int(False) == 0``. A JSON ``true`` in an operator-editable config field
    would otherwise become a 1-round agent or a 0-round agent without anyone
    being told. Booleans are not round counts.

``3.7``
    Floats are accepted only when integral (``3.0`` → 3). Truncating ``3.7``
    would invent a number the operator never wrote.

non-numeric strings, ``None``, ``""``
    Rejected; the next layer decides. An absent key and a garbage value are
    treated identically so a typo cannot silently pin an agent to the default
    while the operator believes otherwise — the WARNING is what distinguishes
    them.

``0`` and negatives
    Clamped up to :data:`MIN_MAX_REACT_ROUNDS` with a log: a zero/negative
    budget is never a real request, it is a mistake, and a run must still
    execute at least one round.

Absurdly large values
    Clamped down to :data:`MAX_MAX_REACT_ROUNDS` with a log. See that constant
    for why the bound is the repo's existing tool-call ceiling.
"""

from __future__ import annotations

import logging
import math
import uuid as uuid_mod
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.schema import WorkspaceCapability

logger = logging.getLogger(__name__)

AGENT_CATEGORY = "agent"

# The value the loop used before any layer could supply one; kept here so the
# "nothing configured" answer is a named constant rather than a bare literal
# repeated across call sites.
DEFAULT_MAX_REACT_ROUNDS = 5

# A run with no rounds cannot answer, so 1 is the floor an operator's mistake
# is clamped to (and it is the floor the previous loop expression already used).
MIN_MAX_REACT_ROUNDS = 1

# Upper bound chosen from this repo's existing per-run ceilings rather than
# invented: `agent_max_tool_calls_per_run` (config.py) is 12, and the loop
# already terminates with `budget_tools` the moment tool calls reach it. A ReAct
# round exists to issue tool calls, so rounds beyond that ceiling cannot buy
# another tool execution — they can only consume the token and wall-clock
# budgets (`agent_max_tokens_per_run` = 12000, `agent_max_duration_s` = 120).
# 12 is therefore the last round count that can still be useful, and it is the
# same order of magnitude as the configured default of 5.
MAX_MAX_REACT_ROUNDS = 12

SOURCE_WORKSPACE_CAPABILITY = "workspace_capability"
SOURCE_AGENT_CARD = "agent_card"
SOURCE_SETTING = "setting"
SOURCE_DEFAULT = "default"


async def _capability_config(
    db: Any, workspace_id: Any, agent_name: str
) -> dict[str, Any] | None:
    """The ``config`` dict of this workspace's ``agent`` row for ``agent_name``.

    Scoped on all three predicates that make the row *this* agent's row —
    ``workspace_id`` (the tenant boundary), ``category == "agent"``, and
    ``name == agent_name`` — so a skill row, a different agent, or an
    identically named row in another workspace can never satisfy the lookup.

    Returns ``None`` — never raises — when there is no row or when the session,
    workspace id or query is unusable. A config lookup that raises would take
    down an agent run, and a config lookup that guesses would cross tenants.
    """
    if db is None:
        return None

    try:
        wid = uuid_mod.UUID(str(workspace_id))
    except (ValueError, TypeError, AttributeError):
        return None

    try:
        res = await db.execute(
            select(WorkspaceCapability.config)
            .where(
                WorkspaceCapability.workspace_id == wid,
                WorkspaceCapability.category == AGENT_CATEGORY,
                WorkspaceCapability.name == agent_name,
            )
            .limit(1)
        )
        return res.scalar_one_or_none()
    except Exception as exc:
        logger.warning(
            "Capability rounds lookup failed (falling through to card/setting): %s", exc
        )
        return None


def _coerce(value: Any, source: str) -> int | None:
    """The round count ``value`` honestly represents, or ``None`` if it has none.

    ``None`` means "this layer has no usable answer" — the caller then tries the
    next layer. A returned int has already been clamped into
    ``[MIN, MAX]``; each clamp is logged with the original value so a value the
    operator wrote can always be compared against the value the run used.
    """
    raw = value

    if isinstance(raw, bool):
        # bool is a subclass of int; `int(True) == 1` would silently turn a
        # checkbox in a config blob into a one-round agent.
        logger.warning(
            "Capability rounds rejected: %r from %s is a bool, not a round count "
            "(bool is an int subclass in Python); falling through",
            raw,
            source,
        )
        return None

    if raw is None:
        return None

    if isinstance(raw, str):
        stripped = raw.strip()
        if not stripped:
            logger.warning(
                "Capability rounds rejected: empty string from %s; falling through",
                source,
            )
            return None
        try:
            parsed: Any = int(stripped, 10)
        except ValueError:
            try:
                as_float = float(stripped)
            except ValueError:
                logger.warning(
                    "Capability rounds rejected: non-numeric %r from %s; falling through",
                    raw,
                    source,
                )
                return None
            if not math.isfinite(as_float) or not as_float.is_integer():
                logger.warning(
                    "Capability rounds rejected: %r from %s is not an integer; "
                    "falling through (truncating would invent a value)",
                    raw,
                    source,
                )
                return None
            parsed = int(as_float)
        raw = parsed

    elif isinstance(raw, float):
        if not math.isfinite(raw) or not raw.is_integer():
            logger.warning(
                "Capability rounds rejected: non-integral float %r from %s; "
                "falling through (truncating would invent a value)",
                raw,
                source,
            )
            return None
        raw = int(raw)

    elif not isinstance(raw, int):
        logger.warning(
            "Capability rounds rejected: unsupported type %s (%r) from %s; falling through",
            type(raw).__name__,
            raw,
            source,
        )
        return None

    if raw < MIN_MAX_REACT_ROUNDS:
        clamped = MIN_MAX_REACT_ROUNDS
        logger.warning(
            "Capability rounds clamped up: %r from %s is below the minimum %d; using %d",
            raw,
            source,
            MIN_MAX_REACT_ROUNDS,
            clamped,
        )
        return clamped

    if raw > MAX_MAX_REACT_ROUNDS:
        logger.warning(
            "Capability rounds clamped down: %r from %s exceeds the ceiling %d "
            "(equal to the per-run tool-call budget, beyond which extra rounds "
            "cannot issue another tool call); using %d",
            raw,
            source,
            MAX_MAX_REACT_ROUNDS,
            MAX_MAX_REACT_ROUNDS,
        )
        return MAX_MAX_REACT_ROUNDS

    return raw


def _from_card(card: Any) -> int | None:
    if card is None:
        return None
    return _coerce(getattr(card, "max_react_rounds", None), SOURCE_AGENT_CARD)


def _from_setting() -> int | None:
    return _coerce(
        getattr(settings, "agent_max_react_rounds", None), SOURCE_SETTING
    )


async def resolve_agent_max_rounds(
    db: AsyncSession | None,
    workspace_id: Any,
    agent_name: str,
    *,
    card: Any = None,
) -> tuple[int, str]:
    """Resolve the ReAct round budget and the layer that decided it.

    Returns ``(rounds, source)`` where ``source`` is one of
    ``"workspace_capability"``, ``"agent_card"``, ``"setting"`` or
    ``"default"``.

    ``db`` may be ``None`` (the loop runs without a session on some paths) and
    ``workspace_id`` may be a non-UUID string; both simply remove the workspace
    layer from consideration rather than raising. The first layer that yields a
    usable, in-range integer wins — never a value that was merely present.
    """
    config = await _capability_config(db, workspace_id, agent_name)
    if isinstance(config, dict) and "max_react_rounds" in config:
        raw = config.get("max_react_rounds")
        if raw is None:
            # A key that is present but null is a different event from an absent
            # key: the operator saved a field and it stored nothing. Reported so
            # "set to nothing" is distinguishable from "never set".
            logger.warning(
                "Capability rounds rejected: %s row has an explicit null "
                "max_react_rounds; falling through",
                SOURCE_WORKSPACE_CAPABILITY,
            )
        else:
            resolved = _coerce(raw, SOURCE_WORKSPACE_CAPABILITY)
            if resolved is not None:
                return resolved, SOURCE_WORKSPACE_CAPABILITY

    resolved = _from_card(card)
    if resolved is not None:
        return resolved, SOURCE_AGENT_CARD

    resolved = _from_setting()
    if resolved is not None:
        return resolved, SOURCE_SETTING

    return DEFAULT_MAX_REACT_ROUNDS, SOURCE_DEFAULT