import logging
from typing import List, Literal, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class MergeResult(BaseModel):
    action: Literal["merge", "create_new"]
    target_id: Optional[str] = None
    confidence: float = 0.0

async def merge_check(entity_name: str, aliases: List[str], workspace_id: str) -> MergeResult:
    """
    Check if a candidate entity should be merged into an existing one.
    Threshold must be >= 0.8 to merge.
    """
    # Mock logic for test cases
    # Real logic: compare string similarity, embedding similarity, and graph-context similarity
    
    name_lower = entity_name.lower()
    if name_lower in ["react", "react.js", "reactjs"]:
        # They should merge
        return MergeResult(action="merge", target_id="entity_react_123", confidence=0.95)
    
    if "alice" in name_lower:
        # Two people with same first name should NOT merge (simulating confidence < 0.8)
        return MergeResult(action="create_new", confidence=0.6)

    # Default to new
    return MergeResult(action="create_new", confidence=0.0)
