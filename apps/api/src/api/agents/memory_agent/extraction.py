import json
import logging

from pydantic import BaseModel

from api.config import settings
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ExtractedEntity(BaseModel):
    name: str
    entity_type: str
    confidence: float
    aliases: list[str] = []


class ExtractedRelationship(BaseModel):
    from_entity: str
    to_entity: str
    relation_type: str
    confidence: float


class ExtractedFacts(BaseModel):
    entities: list[ExtractedEntity]
    relationships: list[ExtractedRelationship]


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
    import re

    entities: list[ExtractedEntity] = []
    relationships: list[ExtractedRelationship] = []
    seen_names: set[str] = set()

    def add_entity(name: str, entity_type: str, confidence: float = 0.9, aliases: list[str] | None = None) -> str | None:
        cleaned = name.strip()
        if cleaned and cleaned.lower() not in seen_names and len(cleaned) > 1:
            seen_names.add(cleaned.lower())
            entities.append(ExtractedEntity(name=cleaned, entity_type=entity_type, confidence=confidence, aliases=aliases or []))
            return cleaned
        return None

    # 1. Tech Skills & Languages
    skill_gazetteer = [
        ("Python", "Skill", ["py", "python3"]),
        ("TypeScript", "Skill", ["TS"]),
        ("JavaScript", "Skill", ["JS", "ES6"]),
        ("React", "Skill", ["React.js", "ReactJS"]),
        ("Next.js", "Skill", ["NextJS"]),
        ("FastAPI", "Skill", []),
        ("SQL", "Skill", ["PostgreSQL", "Postgres"]),
        ("Docker", "Tool", []),
        ("Kubernetes", "Tool", ["K8s"]),
        ("GraphQL", "Skill", []),
        ("Tailwind CSS", "Skill", ["Tailwind"]),
        ("Node.js", "Skill", ["NodeJS"]),
        ("Git", "Tool", ["GitHub"]),
        ("AWS", "Organization", ["Amazon Web Services"]),
        ("GCP", "Organization", ["Google Cloud Platform"]),
        ("Azure", "Organization", ["Microsoft Azure"]),
    ]
    for skill_name, skill_type, aliases in skill_gazetteer:
        pattern = r"\b" + re.escape(skill_name) + r"\b"
        if re.search(pattern, content, re.IGNORECASE):
            add_entity(skill_name, skill_type, 0.9, aliases)

    # 2. Certificates & Badges
    cert_matches = re.findall(r"([A-Za-z0-9_\-\s]{2,40}(?:Certificate|Badge|Certification|Credential|License|Degree|Diploma))", content, re.IGNORECASE)
    for cert in cert_matches[:5]:
        c_clean = cert.strip()
        if len(c_clean) > 3 and not c_clean.lower().startswith("the "):
            add_entity(c_clean, "Certificate", 0.9)

    # 3. Person Names
    name_patterns = [
        r"(?:Name|Candidate|Author|Employee|Student):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})",
    ]
    person_name = None
    for np in name_patterns:
        for m in re.finditer(np, content, re.MULTILINE):
            p = m.group(1).strip()
            if p and len(p.split()) >= 2:
                person_name = add_entity(p, "Person", 0.95)
                break
        if person_name:
            break

    if not person_name:
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        if lines:
            first_line = lines[0]
            if re.match(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$", first_line):
                candidate_words = first_line.split()
                if not any(w.lower() in seen_names for w in candidate_words):
                    person_name = add_entity(first_line, "Person", 0.85)

    # 4. Organizations / Universities
    org_matches = re.findall(r"([A-Z][a-zA-Z0-9\s]{2,30}(?:University|College|Institute|Technologies|Solutions|Labs|Inc|LLC|Corp|Corporation))", content)
    for org in org_matches[:4]:
        o_clean = org.strip()
        add_entity(o_clean, "Organization", 0.88)

    # 5. Connect Person to Skills & Certificates
    if person_name:
        for ent in entities:
            if ent.name != person_name:
                if ent.entity_type == "Certificate":
                    relationships.append(ExtractedRelationship(from_entity=person_name, to_entity=ent.name, relation_type="holds_credential", confidence=0.9))
                elif ent.entity_type in ("Skill", "Tool"):
                    relationships.append(ExtractedRelationship(from_entity=person_name, to_entity=ent.name, relation_type="skilled_in", confidence=0.85))
                elif ent.entity_type == "Organization":
                    relationships.append(ExtractedRelationship(from_entity=person_name, to_entity=ent.name, relation_type="affiliated_with", confidence=0.8))

    return ExtractedFacts(entities=entities, relationships=relationships)

