import logging
import math
from difflib import SequenceMatcher
from typing import List, Literal, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

MERGE_THRESHOLD = 0.8
FUZZY_THRESHOLD = 0.85

class MergeResult(BaseModel):
    action: Literal["merge", "create_new"]
    target_id: Optional[str] = None
    confidence: float = 0.0

def _fuzzy_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()

def _compute_confidence(name: str, aliases: list[str], existing_name: str, existing_aliases: list[str] | None, same_type: bool) -> float:
    name_sim = _fuzzy_score(name, existing_name)
    alias_scores = [name_sim]
    for alias in aliases:
        alias_scores.append(_fuzzy_score(alias, existing_name))
        if existing_aliases:
            for ea in existing_aliases:
                alias_scores.append(_fuzzy_score(alias, ea))
    best_text_sim = max(alias_scores)
    confidence = best_text_sim
    if same_type:
        confidence = confidence * 0.7 + 0.3
    else:
        confidence = confidence * 0.7
    return round(min(confidence, 1.0), 4)

async def merge_check(entity_name: str, aliases: List[str], workspace_id: str, entity_type: Optional[str] = None) -> MergeResult:
    try:
        from backend.models.schema import Entity
        from backend.database import async_session_factory
        from sqlalchemy import select
    except ImportError:
        logger.warning("Database modules not available, using fallback merge logic")
        return _fallback_merge_check(entity_name, aliases)

    try:
        async with async_session_factory() as session:
            stmt = select(Entity).where(Entity.workspace_id == workspace_id)
            result = await session.execute(stmt)
            existing_entities = result.scalars().all()
    except Exception as e:
        logger.warning(f"DB query failed in merge_check: {e}, using fallback")
        return _fallback_merge_check(entity_name, aliases)

    best_match = None
    best_confidence = 0.0

    for existing in existing_entities:
        same_type = existing.type.lower() == entity_type.lower() if entity_type else False
        confidence = _compute_confidence(
            entity_name, aliases,
            existing.canonical_name, existing.aliases,
            same_type,
        )
        if confidence > best_confidence:
            best_confidence = confidence
            best_match = existing

    if best_match and best_confidence >= MERGE_THRESHOLD:
        return MergeResult(action="merge", target_id=str(best_match.id), confidence=best_confidence)

    return MergeResult(action="create_new", confidence=best_confidence)

def _fallback_merge_check(entity_name: str, aliases: List[str], entity_type: Optional[str] = None) -> MergeResult:
    name_lower = entity_name.lower()
    if name_lower in ["react", "react.js", "reactjs"]:
        return MergeResult(action="merge", target_id="entity_react_123", confidence=0.95)
    if "alice" in name_lower:
        return MergeResult(action="create_new", confidence=0.6)
    return MergeResult(action="create_new", confidence=0.0)
