"""
Memory Agent — extract structured entities from user documents.
Upgraded from Phase 4 modules to full specialist agent with handler.
"""
import hashlib
import logging
import uuid
from typing import Any, Dict, List

from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from .extraction import extract, ExtractedFacts
from .merge import merge_check, MergeResult
from .retrieval import retrieve, RetrievedMemory

from sqlalchemy import func

logger = logging.getLogger(__name__)

_MEMORY_TYPE_MAP = {
    "person": "person",
    "organization": "organization",
    "event": "event",
    "skill": "skill",
    "preference": "preference",
    "career": "career",
    "education": "education",
}


class MemoryAgentHandler(BaseAgent):
    mission = "Extract structured entities from user documents"
    tools = [
        Tool(name="search_documents", description="Search workspace documents"),
        Tool(name="create_entity", description="Create knowledge graph entity"),
        Tool(name="merge_entities", description="Merge duplicate entities"),
        Tool(name="query_graph", description="Query knowledge graph"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["profile", "document"],
        write_types=["profile", "document"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "memory",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more context to extract entities from this content.",
                "details": None,
                "proposals": [],
                "questions": ["Could you provide more details about this document?"],
            },
        }

    async def execute(
        self,
        content: str,
        source_type: str,
        source_id: str,
        workspace_id: str,
    ) -> Dict[str, Any]:
        """
        Full Memory Agent flow:
        1. Extract entities/relationships from content
        2. Check for duplicates via merge_check
        3. Persist extracted memories to the database
        4. Return results for knowledge graph update
        """
        # 1. Extract facts
        facts: ExtractedFacts = await extract(content, source_type, source_id, workspace_id)

        # 2. Check each entity for merge candidates
        merge_results: List[Dict[str, Any]] = []
        for entity in facts.entities:
            result: MergeResult = await merge_check(
                entity.name, entity.aliases, workspace_id, entity.entity_type
            )
            merge_results.append({
                "entity": entity.name,
                "action": result.action,
                "target_id": result.target_id,
                "confidence": result.confidence,
            })

        # 3. Persist to database: memories + entities + relationships
        persisted_count = 0
        entities_created = 0
        relationships_created = 0
        entity_id_map: Dict[str, uuid.UUID] = {}  # name -> DB id for relationship resolution

        try:
            from ...database import async_session_factory
            from ...models.schema import Memory, Entity, Relationship

            async with async_session_factory() as db:
                # 3a. Create Entity rows (knowledge graph nodes)
                for i, entity in enumerate(facts.entities):
                    merge_decision = merge_results[i] if i < len(merge_results) else None
                    entity_id = None

                    if merge_decision and merge_decision["action"] == "merge" and merge_decision.get("target_id"):
                        # Merge: update existing entity's aliases
                        try:
                            target_uuid = uuid.UUID(merge_decision["target_id"])
                            from sqlalchemy import select
                            stmt = select(Entity).where(Entity.id == target_uuid)
                            result = await db.execute(stmt)
                            existing = result.scalar_one_or_none()
                            if existing:
                                # Merge aliases
                                new_aliases = list(set((existing.aliases or []) + entity.aliases))
                                existing.aliases = new_aliases
                                existing.updated_at = func.now() if hasattr(existing, 'updated_at') else None
                                entity_id = existing.id
                                logger.info("Merged entity '%s' into existing %s", entity.name, entity_id)
                        except (ValueError, Exception) as exc:
                            logger.warning("Merge failed for entity '%s': %s", entity.name, exc)

                    if entity_id is None:
                        # Create new entity
                        new_entity = Entity(
                            workspace_id=uuid.UUID(workspace_id),
                            type=entity.entity_type,
                            canonical_name=entity.name,
                            aliases=entity.aliases or [],
                            metadata_={"confidence": entity.confidence, "source": source_type},
                        )
                        db.add(new_entity)
                        await db.flush()  # get the ID
                        entity_id = new_entity.id
                        entities_created += 1

                    entity_id_map[entity.name.lower()] = entity_id

                # 3b. Persist relationships (knowledge graph edges)
                for rel in facts.relationships:
                    from_entity_id = entity_id_map.get(rel.from_entity.lower())
                    to_entity_id = entity_id_map.get(rel.to_entity.lower())
                    if from_entity_id and to_entity_id and from_entity_id != to_entity_id:
                        relationship = Relationship(
                            workspace_id=uuid.UUID(workspace_id),
                            from_entity_id=from_entity_id,
                            to_entity_id=to_entity_id,
                            relation_type=rel.relation_type,
                            confidence=rel.confidence,
                            metadata_={"source": source_type, "source_id": source_id},
                        )
                        db.add(relationship)
                        relationships_created += 1

                # 3c. Create Memory rows (for API-level retrieval)
                for entity in facts.entities:
                    content_hash = hashlib.sha256(
                        (entity.name + entity.entity_type).encode()
                    ).hexdigest()
                    memory_type = _MEMORY_TYPE_MAP.get(
                        entity.entity_type.lower(), "document"
                    )
                    memory = Memory(
                        type=memory_type,
                        domain=entity.entity_type,
                        status="READY",
                        title=entity.name,
                        summary=f"Entity: {entity.entity_type}",
                        content=f"Aliases: {', '.join(entity.aliases)}" if entity.aliases else None,
                        content_hash=content_hash,
                        size=len(entity.name),
                        workspace_id=uuid.UUID(workspace_id),
                        source_type=source_type,
                        source_uri=source_id,
                        tags=[entity.entity_type] + (entity.aliases or []),
                    )
                    db.add(memory)
                    persisted_count += 1

                await db.commit()

        except Exception as exc:
            logger.warning("Failed to persist to DB: %s", exc)

        return {
            "agent_name": "memory",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": (
                    f"Extracted {len(facts.entities)} entities, "
                    f"{len(facts.relationships)} relationships. "
                    f"Persisted {persisted_count} memories, "
                    f"{entities_created} new entities, "
                    f"{relationships_created} relationships."
                ),
                "details": {
                    "entities": [e.model_dump() for e in facts.entities],
                    "relationships": [r.model_dump() for r in facts.relationships],
                    "merge_decisions": merge_results,
                    "persisted_count": persisted_count,
                    "entities_created": entities_created,
                    "relationships_created": relationships_created,
                },
                "proposals": [],
                "questions": [],
            },
        }
