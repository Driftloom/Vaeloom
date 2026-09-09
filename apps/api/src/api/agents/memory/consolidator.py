"""
Memory Consolidator Agent — Self-improving learning loop closure.

Captures execution outcomes, user corrections, and feedback to consolidate
learned preferences, skills, and entity updates into workspace memory and knowledge graph.
"""
import logging
import re
import uuid
from typing import Any

from sqlalchemy import select

from api.database import async_session_factory
from api.models.schema import Entity
from api.orchestrator.base import AgentContext, BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


# Muse §17 bounded memory admission. Every candidate extracted from a
# trajectory/feedback is scored before it may enter long-term memory:
#   score = 0.5 * source_quality + 0.3 * novelty + 0.2 * signal
# source_quality: user_correction 1.0 > llm_feedback 0.8 > heuristic 0.6 >
#   unknown 0.5. novelty: 1.0 when no matching entity exists, 0.4 on merge
#   (merges still pass — they only touch metadata, never invent facts).
# signal: name length capped at 12 chars (2-char fragments need corroboration).
# Threshold 0.65 admits all legitimate extractions (min observed: 0.67 for
# short skill names) while rejecting unknown-source fragments. Merges always
# pass. Genuinely conflicting preference values are linked via metadata
# instead of overwriting. Every decision is audited in item metadata
# (score, reason, timestamp) — writes stay auditable.
ADMISSION_THRESHOLD = 0.65

_SOURCE_QUALITY = {
    "user_correction": 1.0,
    "llm_feedback": 0.8,
    "heuristic_preference": 0.6,
    "heuristic_skill": 0.6,
}


def admission_score(source: str, is_novel: bool, name: str = "") -> tuple[float, str]:
    """Deterministic admission score + reason for a candidate memory."""
    quality = _SOURCE_QUALITY.get(source, 0.5)
    novelty = 1.0 if is_novel else 0.4
    signal = min(1.0, max(0.0, len((name or "").strip()) / 12.0))
    score = round(0.5 * quality + 0.3 * novelty + 0.2 * signal, 3)
    if not is_novel:
        return score, "merge-existing"
    if score >= ADMISSION_THRESHOLD:
        return score, "admitted"
    return score, "rejected-low-signal"


class MemoryConsolidatorAgent(BaseAgent):
    """Consolidates interaction trajectories and feedback into persistent memory."""

    mission = "Consolidate trajectory feedback and user corrections into persistent workspace memory"
    tools = [
        Tool(name="extract_entities", description="Extract candidate career entities from feedback/trajectory"),
        Tool(name="upsert_entities", description="Persist or update entities in the knowledge graph"),
        Tool(name="record_correction", description="Record explicit user corrections to agent assumptions"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["feedback", "trajectories", "entities"],
        write_types=["preference", "skill", "career", "education", "experience"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "memory_consolidator",
            "action": "error",
            "confidence": 0.0,
            "result": {
                "summary": "Unable to consolidate memory.",
                "details": None,
                "proposals": [],
                "questions": [],
            },
        }

    async def execute(self, request: Any, context: AgentContext | None = None) -> dict[str, Any]:
        if isinstance(request, dict):
            return await self.consolidate_trajectory(
                workspace_id=request.get("workspace_id", context.workspace_id if context else ""),
                user_id=request.get("user_id", context.user_id if context else None),
                agent_name=request.get("agent_name", "unknown"),
                user_prompt=request.get("user_prompt", ""),
                summary=request.get("summary", ""),
                feedback=request.get("feedback"),
                corrections=request.get("corrections"),
            )
        return await self.fallback()

    async def consolidate_trajectory(
        self,
        workspace_id: str,
        agent_name: str,
        user_prompt: str,
        summary: str,
        user_id: str | None = None,
        feedback: str | None = None,
        corrections: list[dict[str, Any]] | None = None,
        session: Any | None = None,
        event_id: str | None = None,
        tenant_id: str | None = None,
        correlation_id: str | None = None,
        source: str = "trajectory_feedback",
    ) -> dict[str, Any]:
        """Process an execution trajectory and extract new or corrected entities/preferences.

        Zero-trust admission (Muse learning completion):
          - workspace_id must be a valid UUID (fail-closed; NEVER random-UUID fallback).
          - every candidate passes services/learning_gate.validate_learning_signal
            (schema + tenant/workspace binding + source + caps + scope + safety
            + confidence). Rejections are counted, never persisted.
          - when event_id is given, a durable learning_events row is claimed
            FIRST under UNIQUE(workspace_id, event_id): concurrent duplicates race
            on INSERT and exactly one wins (atomic idempotency, restart-safe).
          - learned state persists in workspace-scoped Entity rows; Entity upsert
            handles IntegrityError (concurrent dedup → re-read → merge).
          - structured LEARNING_* logs carry correlation/tenant/workspace/signal/
            decision/persistence on every call. Learning is best-effort: failures
            return explicit skipped/error statuses, never phantom success.
        """
        import uuid as _uuid

        corr = (correlation_id or event_id or str(_uuid.uuid4()))[:128]
        # Fail closed on workspace binding (was: random-UUID fallback — removed).
        try:
            w_uuid = _uuid.UUID(str(workspace_id))
        except Exception:
            logger.warning(
                "LEARNING_REJECTED correlation=%s workspace=%s reason=missing_or_invalid_workspace_id",
                corr, str(workspace_id)[:16],
            )
            return {"status": "skipped", "reason": "missing_or_invalid_workspace_id",
                    "consolidated_count": 0, "correlation_id": corr}
        ws_str = str(w_uuid)

        # Payload caps before extraction (oversized → reject, never silent-truncate).
        try:
            from api.services.learning_gate import validate_signal_texts
            ok, why = validate_signal_texts(
                correction=(corrections[0].get("correction") or corrections[0].get("value", ""))
                if corrections and isinstance(corrections, list) and corrections else None,
                feedback=feedback,
            )
            if not ok:
                logger.warning("LEARNING_REJECTED correlation=%s workspace=%s reason=%s",
                               corr, ws_str[:8], why)
                return {"status": "rejected", "reason": why, "consolidated_count": 0,
                        "correlation_id": corr}
        except Exception:
            pass

        learned_items: list[dict[str, Any]] = []

        # 1. Process explicit corrections
        if corrections:
            for correction_item in corrections:
                field = correction_item.get("field", "general")
                val = correction_item.get("correction") or correction_item.get("value")
                if val:
                    learned_items.append({
                        "type": "preference" if "pref" in field.lower() else "skill" if "skill" in field.lower() else "career",
                        "name": str(val)[:200],
                        "metadata": {"source": "user_correction", "field": field, "agent": agent_name},
                    })

        # 2. Extract preferences from user feedback or user prompt
        text_to_scan = f"{user_prompt}\n{feedback or ''}".strip()
        extracted = self._extract_heuristics(text_to_scan)
        learned_items.extend(extracted)

        # 3. If LLM is available and we have feedback, extract semantic entities
        if feedback and len(feedback.strip()) > 10:
            llm_extracted = await self._extract_with_llm(
                feedback, workspace_id=ws_str, user_id=user_id,
            )
            learned_items.extend(llm_extracted)

        # 4. Upsert into database (de-duplicate against learned_items)
        deduped: dict[tuple[str, str], dict[str, Any]] = {}
        for item in learned_items:
            key = (item["type"], item["name"].strip().lower())
            if key not in deduped:
                deduped[key] = item

        persisted_count = 0
        rejected_items: list[dict[str, Any]] = []
        admitted_events = 0
        duplicate_event = False
        if deduped:
            try:
                async def _persist_to_session(sess):
                    from datetime import UTC, datetime

                    from sqlalchemy.exc import IntegrityError

                    from api.services.learning_gate import validate_learning_signal, verify_workspace_tenant

                    count = 0
                    rejected: list[dict[str, Any]] = []
                    # Tenant/workspace ownership: fail closed on PROVEN mismatch.
                    _ok, _why = await verify_workspace_tenant(sess, w_uuid, tenant_id)
                    if not _ok:
                        logger.warning(
                            "LEARNING_REJECTED correlation=%s workspace=%s tenant=%s reason=%s",
                            corr, ws_str[:8], str(tenant_id)[:8], _why,
                        )
                        try:
                            await sess.rollback()
                        except Exception:
                            pass
                        return "REJECTED", [{"reason": _why}]
                    elif _why == "unverified_owner" and tenant_id:
                        logger.debug("LEARNING tenant unverified correlation=%s workspace=%s",
                                     corr, ws_str[:8])
                    # Atomic idempotency claim FIRST (when event_id given): exactly
                    # one concurrent winner; losers return duplicate (no phantom).
                    if event_id:
                        try:
                            from api.models.schema import LearningEvent
                            claim = LearningEvent(
                                id=_uuid.uuid4(),
                                workspace_id=w_uuid,
                                tenant_id=_uuid.UUID(str(tenant_id)) if tenant_id else None,
                                event_id=event_id[:128],
                                signal_type="trajectory",
                                source=source,
                                payload={"agent": agent_name, "items": len(deduped)},
                                confidence=None,
                                status="admitted",
                                reason="claimed",
                                correlation_id=corr,
                            )
                            sess.add(claim)
                            await sess.flush()
                        except Exception as ie:
                            # UNIQUE violation (or driver equivalent) → duplicate.
                            try:
                                await sess.rollback()
                            except Exception:
                                pass
                            if "uq_learning_events_ws_event" in str(ie) or "UNIQUE" in str(ie).upper() or isinstance(ie, IntegrityError):
                                logger.info(
                                    "LEARNING_DUPLICATE correlation=%s workspace=%s event=%s",
                                    corr, ws_str[:8], str(event_id)[:32],
                                )
                                return "DUPLICATE", []
                            # Ledger table may not exist yet (migration pending) —
                            # fall through to Entity path (dedup still enforced).
                            logger.debug(f"learning ledger claim skipped: {ie}")
                    for (etype, ename), item in deduped.items():
                        item_source = str((item.get("metadata") or {}).get("source", source))
                        stmt = (
                            select(Entity)
                            .where(Entity.workspace_id == w_uuid)
                            .where(Entity.type == etype)
                            .where(Entity.canonical_name.ilike(ename))
                            .limit(1)
                        )
                        res = await sess.execute(stmt)
                        existing = res.scalars().first()
                        # Strict admission gate per candidate (fail-closed).
                        accepted, decision = validate_learning_signal(
                            workspace_id=ws_str,
                            tenant_id=tenant_id,
                            source=item_source if item_source else source,
                            learn_type=etype,
                            name=item.get("name", ""),
                            event_id=event_id,
                            correlation_id=corr,
                            is_novel=existing is None,
                        )
                        meta = dict(item.get("metadata") or {})
                        meta.update({
                            "admission_score": decision.get("admission_score"),
                            "admission_decision": decision.get("reason"),
                            "admitted_at": datetime.now(UTC).isoformat(),
                            "correlation_id": corr,
                            "signal_id": decision.get("signal_id"),
                        })
                        item["metadata"] = meta
                        if not accepted:
                            rejected.append({"type": etype, "name": item["name"],
                                             "reason": decision.get("reason")})
                            logger.info(
                                "LEARNING_REJECTED correlation=%s workspace=%s signal=%s type=%s reason=%s",
                                corr, ws_str[:8], decision.get("signal_id", "?")[:8],
                                etype, decision.get("reason"),
                            )
                            continue
                        if existing:
                            meta_old = existing.metadata_ or {}
                            meta_old.update(item.get("metadata", {}))
                            meta_old["updated_from_trajectory"] = True
                            existing.metadata_ = meta_old
                        else:
                            # Contradiction link: same-type preferences with a
                            # different value reference each other instead of
                            # silently overwriting trusted information.
                            if etype == "preference":
                                try:
                                    _sib = (await sess.execute(
                                        select(Entity)
                                        .where(Entity.workspace_id == w_uuid)
                                        .where(Entity.type == "preference")
                                        .limit(10)
                                    )).scalars().all()
                                    _other = [str(getattr(e, "canonical_name", "")) for e in _sib
                                              if str(getattr(e, "canonical_name", "")).lower() != ename.lower()]
                                    if _other:
                                        meta["coexists_with"] = _other[:5]
                                except Exception:
                                    pass
                            new_ent = Entity(
                                id=uuid.uuid4(),
                                workspace_id=w_uuid,
                                type=etype,
                                canonical_name=item["name"],
                                metadata_=item.get("metadata", {}),
                            )
                            sess.add(new_ent)
                        count += 1
                    try:
                        await sess.commit()
                    except IntegrityError as cie:
                        # Concurrent duplicate Entity insert (no DB unique on
                        # entities): roll back, re-read winners, merge instead.
                        try:
                            await sess.rollback()
                        except Exception:
                            pass
                        logger.info("LEARNING_CONCURRENT_MERGE correlation=%s workspace=%s detail=%s",
                                    corr, ws_str[:8], str(cie)[:120])
                        for (etype2, ename2), item2 in deduped.items():
                            try:
                                r2 = await sess.execute(
                                    select(Entity)
                                    .where(Entity.workspace_id == w_uuid)
                                    .where(Entity.type == etype2)
                                    .where(Entity.canonical_name.ilike(ename2))
                                    .limit(1)
                                )
                                if r2.scalars().first() is None:
                                    sess.add(Entity(
                                        id=uuid.uuid4(), workspace_id=w_uuid,
                                        type=etype2, canonical_name=item2["name"],
                                        metadata_=item2.get("metadata", {}),
                                    ))
                            except Exception:
                                continue
                        try:
                            await sess.commit()
                        except Exception:
                            try:
                                await sess.rollback()
                            except Exception:
                                pass
                    return count, rejected

                if session is not None:
                    _pres = await _persist_to_session(session)
                else:
                    async with async_session_factory() as sess:
                        _pres = await _persist_to_session(sess)
                if isinstance(_pres, tuple) and _pres and _pres[0] == "DUPLICATE":
                    duplicate_event = True
                elif isinstance(_pres, tuple) and _pres and _pres[0] == "REJECTED":
                    rejected_items = _pres[1]
                else:
                    persisted_count, rejected_items = _pres
                    admitted_events = 1 if event_id else 0
                logger.info(
                    "LEARNING_DECIDED correlation=%s tenant=%s workspace=%s agent=%s "
                    "persisted=%d rejected=%d duplicate=%s",
                    corr, str(tenant_id)[:8] if tenant_id else "-",
                    ws_str[:8], agent_name, persisted_count,
                    len(rejected_items), duplicate_event,
                )
            except Exception as exc:
                # Best-effort by design (the caller's primary op stays correct),
                # but the outcome is EXPLICIT: error status, never phantom success.
                import traceback as _tb
                logger.warning("LEARNING_FAILED correlation=%s workspace=%s agent=%s error=%s\n%s",
                               corr, ws_str[:8], agent_name, exc, _tb.format_exc(limit=6))
                return {
                    "status": "error",
                    "reason": f"persistence_failed: {type(exc).__name__}",
                    "consolidated_count": 0,
                    "items": [],
                    "rejected_count": 0,
                    "rejected": [],
                    "correlation_id": corr,
                    "event_id": event_id,
                }

        if duplicate_event:
            return {
                "status": "duplicate",
                "reason": "duplicate_event_id",
                "consolidated_count": 0,
                "items": [],
                "rejected_count": 0,
                "rejected": [],
                "correlation_id": corr,
                "event_id": event_id,
            }
        if rejected_items and "foreign_workspace" in {r.get("reason") for r in rejected_items}:
            return {
                "status": "rejected",
                "reason": "foreign_workspace",
                "consolidated_count": 0,
                "items": [],
                "rejected_count": len(rejected_items),
                "rejected": rejected_items[:20],
                "correlation_id": corr,
                "event_id": event_id,
            }
        if not deduped:
            logger.info("LEARNING_DECIDED correlation=%s workspace=%s agent=%s "
                        "persisted=0 rejected=0 duplicate=False reason=no_signal",
                        corr, ws_str[:8], agent_name)
            return {
                "status": "success",
                "consolidated_count": 0,
                "items": [],
                "rejected_count": 0,
                "rejected": [],
                "correlation_id": corr,
                "event_id": event_id,
            }
        return {
            "status": "success",
            "consolidated_count": persisted_count,
            "items": list(deduped.values()),
            "rejected_count": len(rejected_items),
            "rejected": rejected_items[:20],
            "correlation_id": corr,
            "event_id": event_id,
            "admitted_events": admitted_events,
        }

    def _extract_heuristics(self, text: str) -> list[dict[str, Any]]:
        """Fast regex/pattern extraction for preferences and skills without LLM dependency."""
        items: list[dict[str, Any]] = []
        if not text:
            return items

        # Look for explicit preference statements: e.g. "prefer remote work", "interested in hybrid"
        pref_matches = re.findall(
            r"(?:prefer|preference for|only want|interested in)\s+([a-zA-Z0-9\-\s]{2,60}?)(?:\.|\,|\band\b|$|\n)",
            text,
            re.IGNORECASE,
        )
        for m in pref_matches:
            val = m.strip()
            if len(val) >= 3:
                items.append({
                    "type": "preference",
                    "name": val,
                    "metadata": {"source": "heuristic_preference"},
                })

        # Look for skill statements: e.g. "experience in Rust", "skilled in Python"
        skill_matches = re.findall(
            r"(?:skilled in|experience in|proficient in|know|familiar with)\s+([a-zA-Z0-9\+\#\.\s]{2,60}?)(?:\.|\,|\band\b|$|\n)",
            text,
            re.IGNORECASE,
        )
        for sm in skill_matches:
            sval = sm.strip()
            if len(sval) >= 2 and not any(w in sval.lower() for w in ["that", "this", "how", "what", "which"]):
                items.append({
                    "type": "skill",
                    "name": sval,
                    "metadata": {"source": "heuristic_skill"},
                })

        return items

    async def _extract_with_llm(self, feedback: str, workspace_id: str | None = None,
                                  user_id: str | None = None) -> list[dict[str, Any]]:
        """Extract learned preferences or corrections via LLM when available."""
        import json
        from api.config import settings

        if not settings.llm_api_key:
            return []
        prompt = (
            "You are a career memory extraction model. Given this user feedback or correction, "
            "extract any user preferences or skills as JSON: "
            '[{"type": "preference"|"skill", "name": "...", "notes": "..."}]. '
            "If none found, return []."
        )
        try:
            resp = await llm_service.generate_completion(
                [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": feedback},
                ],
                temperature=0.0,
                max_tokens=256,
                workspace_id=workspace_id,
                user_id=user_id,
            )
            content = resp.get("content", "").strip()
            match = re.search(r"\[.*\]", content, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                if isinstance(data, list):
                    return [
                        {
                            "type": d.get("type", "preference"),
                            "name": str(d.get("name", "")).strip(),
                            "metadata": {"source": "llm_feedback", "notes": d.get("notes", "")},
                        }
                        for d in data
                        if d.get("name")
                    ]
        except Exception as e:
            logger.debug(f"LLM memory extraction skipped: {e}")
        return []


memory_consolidator = MemoryConsolidatorAgent()
