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
    ) -> dict[str, Any]:
        """Process an execution trajectory and extract new or corrected entities/preferences."""
        if not workspace_id:
            return {"status": "skipped", "reason": "missing_workspace_id", "consolidated_count": 0}

        learned_items: list[dict[str, Any]] = []

        # 1. Process explicit corrections
        if corrections:
            for corr in corrections:
                field = corr.get("field", "general")
                val = corr.get("correction") or corr.get("value")
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
            llm_extracted = await self._extract_with_llm(feedback)
            learned_items.extend(llm_extracted)

        # 4. Upsert into database (de-duplicate against learned_items)
        deduped: dict[tuple[str, str], dict[str, Any]] = {}
        for item in learned_items:
            key = (item["type"], item["name"].strip().lower())
            if key not in deduped:
                deduped[key] = item

        persisted_count = 0
        rejected_items: list[dict[str, Any]] = []
        if deduped and workspace_id:
            try:
                try:
                    w_uuid = uuid.UUID(str(workspace_id))
                except Exception:
                    w_uuid = uuid.uuid4()

                async def _persist_to_session(sess):
                    from datetime import UTC, datetime
                    count = 0
                    rejected: list[dict[str, Any]] = []
                    for (etype, ename), item in deduped.items():
                        stmt = (
                            select(Entity)
                            .where(Entity.workspace_id == w_uuid)
                            .where(Entity.type == etype)
                            .where(Entity.canonical_name.ilike(ename))
                            .limit(1)
                        )
                        res = await sess.execute(stmt)
                        existing = res.scalars().first()
                        source = str((item.get("metadata") or {}).get("source", "heuristic_preference"))
                        score, decision = admission_score(source, is_novel=existing is None, name=item.get("name", ""))
                        meta = dict(item.get("metadata") or {})
                        meta.update({
                            "admission_score": score,
                            "admission_decision": decision,
                            "admitted_at": datetime.now(UTC).isoformat(),
                        })
                        item["metadata"] = meta
                        if existing is None and decision == "rejected-low-signal":
                            rejected.append({"type": etype, "name": item["name"], "score": score})
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
                    await sess.commit()
                    return count, rejected

                if session is not None:
                    persisted_count, rejected_items = await _persist_to_session(session)
                else:
                    async with async_session_factory() as sess:
                        persisted_count, rejected_items = await _persist_to_session(sess)
            except Exception as exc:
                logger.warning(f"MemoryConsolidator upsert error (non-blocking): {exc}")

        return {
            "status": "success",
            "consolidated_count": persisted_count,
            "items": list(deduped.values()),
            "rejected_count": len(rejected_items),
            "rejected": rejected_items[:20],
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

    async def _extract_with_llm(self, feedback: str) -> list[dict[str, Any]]:
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
