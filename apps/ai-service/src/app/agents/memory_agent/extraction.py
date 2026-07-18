import logging
from typing import List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class ExtractedEntity(BaseModel):
    name: str
    entity_type: str  # Skill | Project | Organization | Person | Certificate ...
    confidence: float
    aliases: List[str] = []

class ExtractedRelationship(BaseModel):
    from_entity: str
    to_entity: str
    relation_type: str  # worked_on | awarded_to | requires_skill ...
    confidence: float

class ExtractedFacts(BaseModel):
    entities: List[ExtractedEntity]
    relationships: List[ExtractedRelationship]

async def extract(content: str, source_type: str, source_id: str, workspace_id: str) -> ExtractedFacts:
    """
    Mock implementation of LLM extraction with JSON schema constraints.
    Returns typed entities and relationships.
    """
    logger.info(f"Extracting facts from {source_id} in {workspace_id}")
    
    # Mocking response
    # Real implementation would call gateway.complete(...) with structured output
    
    if "React" in content:
        return ExtractedFacts(
            entities=[
                ExtractedEntity(name="React", entity_type="Skill", confidence=0.9, aliases=["React.js", "ReactJS"])
            ],
            relationships=[]
        )
    
    return ExtractedFacts(entities=[], relationships=[])
