"""Wire contract for validating an UNSAVED capability draft.

Why this exists
---------------
``POST /api/v1/capabilities/{id}/test`` needs a minted UUID and
``POST /api/v1/agents/capabilities/test`` looks the capability up by name in the
database, so an author inside the "New Skill" modal cannot validate what they are
typing until they save it. :class:`CapabilityDraftRequest` carries the same field
set a create carries so the server can run the real validators against unsaved
input.

``autonomy`` and ``trust_class`` are typed ``str | None`` rather than the real
enums on purpose: a validator endpoint must *report* a bad enum value as a
violation so the author can see it in the list, not reject the request with a 422
before any rule has run.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

DraftStatus = Literal["success", "warning", "error", "not_validated"]

Severity = Literal["hard", "soft"]

#: Where the validated rules came from. ``draft`` is the author's own document,
#: ``catalog`` is the bundled skill of the same name the author is editing a copy
#: of, ``delegated`` means a validator this endpoint does not own did the checking
#: (the MCP config validator, the connector service, the plugin registration
#: schema, the live tool/agent registries), and ``none`` means nothing validated
#: the capability's substance at all — which is what ``not_validated`` reports.
DraftSource = Literal["draft", "catalog", "delegated", "none"]


class DraftViolation(BaseModel):
    rule: str
    message: str
    line: int | None = None
    severity: Severity = "hard"


class CapabilityDraftRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=50)
    description: str = Field(default="", max_length=2000)
    config: dict[str, Any] = Field(default_factory=dict)
    autonomy: str | None = Field(default=None, max_length=64)
    trust_class: str | None = Field(default=None, max_length=64)


class CapabilityDraftValidationResponse(BaseModel):
    """A validation verdict. Nothing on this response was executed.

    ``executed`` is typed ``Literal[False]`` so no code path can return a draft
    validation that reads as a live run — the schema itself rejects it.

    ``status`` values:

    * ``success`` — every rule that ran passed.
    * ``warning`` — only soft rules failed; the draft is savable as-is.
    * ``error`` — at least one hard rule failed; the create path would reject it.
    * ``not_validated`` — the category is a real one but no validator exists for
      it (a connector whose declared type no clause covers). Only the shared
      draft rules ran; ``validated_source`` is ``none`` and ``detail`` says so.
      A category with no validator never returns a fabricated pass. An unknown
      category is not this state — it is an ``error`` from ``CATEGORY-VALID``.
    """

    status: DraftStatus
    rules_checked: int
    violations: list[DraftViolation] = Field(default_factory=list)
    executed: Literal[False] = False
    category: str
    validated_source: DraftSource = "draft"
    catalog_slug: str | None = None
    detail: str = ""
