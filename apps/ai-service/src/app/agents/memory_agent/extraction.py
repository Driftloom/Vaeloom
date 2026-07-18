import json
import logging
from typing import List, Optional
from pydantic import BaseModel

from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ExtractedEntity(BaseModel):
    name: str
    entity_type: str
    confidence: float
    aliases: List[str] = []


class ExtractedRelationship(BaseModel):
    from_entity: str
    to_entity: str
    relation_type: str
    confidence: float


class ExtractedFacts(BaseModel):
    entities: List[ExtractedEntity]
    relationships: List[ExtractedRelationship]


async def extract(content: str, source_type: str, source_id: str, workspace_id: str) -> ExtractedFacts:
    logger.info(f"Extracting facts from {source_id} ({source_type})")

    if not content.strip():
        return ExtractedFacts(entities=[], relationships=[])

    if not settings.llm_api_key:
        return _mock_extract(content)

    try:
        response = await llm_service.generate_completion([
            {"role": "system", "content": "Extract structured entities and relationships from the given content. Return ONLY valid JSON: {\"entities\": [{\"name\": \"...\", \"entity_type\": \"Skill|Project|Organization|Person|Certificate|Education|Tool|Language\", \"confidence\": 0.0-1.0, \"aliases\": []}], \"relationships\": [{\"from_entity\": \"...\", \"to_entity\": \"...\", \"relation_type\": \"worked_on|awarded_to|requires_skill|used_in|taught_at|studied_at\", \"confidence\": 0.0-1.0}]}. Be thorough but only extract what's explicitly stated or clearly implied."},
            {"role": "user", "content": f"Content ({source_type}):\n{content}"},
        ], temperature=0.3, max_tokens=1000)
        text = response["content"].strip()
        text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)

        entities = [ExtractedEntity(**e) for e in data.get("entities", [])]
        relationships = [ExtractedRelationship(**r) for r in data.get("relationships", [])]
        return ExtractedFacts(entities=entities, relationships=relationships)

    except Exception as e:
        logger.warning(f"LLM extraction failed, falling back to mock: {e}")
        return _mock_extract(content)


def _mock_extract(content: str) -> ExtractedFacts:
    if "React" in content:
        return ExtractedFacts(
            entities=[
                ExtractedEntity(name="React", entity_type="Skill", confidence=0.9, aliases=["React.js", "ReactJS"])
            ],
            relationships=[]
        )

    return ExtractedFacts(entities=[], relationships=[])
