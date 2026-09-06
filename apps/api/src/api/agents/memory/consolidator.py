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
        if deduped and workspace_id:
            try:
                try:
                    w_uuid = uuid.UUID(str(workspace_id))
                except Exception:
                    w_uuid = uuid.uuid4()

                async def _persist_to_session(sess):
                    count = 0
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
                        if existing:
                            meta = existing.metadata_ or {}
                            meta.update(item.get("metadata", {}))
                            meta["updated_from_trajectory"] = True
                            existing.metadata_ = meta
                        else:
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
                    return count

                if session is not None:
                    persisted_count = await _persist_to_session(session)
                else:
                    async with async_session_factory() as sess:
                        persisted_count = await _persist_to_session(sess)
            except Exception as exc:
                logger.warning(f"MemoryConsolidator upsert error (non-blocking): {exc}")

        return {
            "status": "success",
            "consolidated_count": persisted_count,
            "items": list(deduped.values()),
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
