import enum
from dataclasses import dataclass, field
from datetime import timedelta


class MemoryType(enum.StrEnum):
    Person = "person"
    Organization = "organization"
    Project = "project"
    Skill = "skill"
    Achievement = "achievement"
    Education = "education"
    Experience = "experience"
    Certification = "certification"
    Publication = "publication"
    Patent = "patent"
    Award = "award"
    Meeting = "meeting"
    Task = "task"
    Goal = "goal"
    Preference = "preference"
    Constraint = "constraint"
    Insight = "insight"
    Connection = "connection"
    Location = "location"
    Event = "event"
    Document = "document"
    Conversation = "conversation"


@dataclass
class MemoryTypeConfig:
    type_name: str
    description: str
    extraction_prompt: str
    validation_rules: list[str] = field(default_factory=list)
    default_ttl: timedelta = timedelta(days=365)
    search_weight: float = 1.0


MEMORY_TYPE_REGISTRY: dict[str, MemoryTypeConfig] = {
    "person": MemoryTypeConfig(
        type_name="person",
        description="Individual person entity with biographical and relational data",
        extraction_prompt="Extract person entities including name, role, contact info, affiliations, and relationships mentioned in the content",
        validation_rules=["name_required", "type_check_person"],
        default_ttl=timedelta(days=730),
        search_weight=1.8,
    ),
    "organization": MemoryTypeConfig(
        type_name="organization",
        description="Company, institution, or group entity",
        extraction_prompt="Extract organization names, industry, size, location, and hierarchical structure",
        validation_rules=["name_required"],
        default_ttl=timedelta(days=730),
        search_weight=1.6,
    ),
    "project": MemoryTypeConfig(
        type_name="project",
        description="Project entity with scope, timeline, and stakeholders",
        extraction_prompt="Extract project details including name, objectives, timeline, team members, technologies, and status",
        validation_rules=["name_required", "timeline_check"],
        default_ttl=timedelta(days=365),
        search_weight=1.5,
    ),
    "skill": MemoryTypeConfig(
        type_name="skill",
        description="Technical or soft skill with proficiency level",
        extraction_prompt="Extract skills mentioned, including proficiency level, experience duration, and context of use",
        validation_rules=["name_required"],
        default_ttl=timedelta(days=365),
        search_weight=1.4,
    ),
    "achievement": MemoryTypeConfig(
        type_name="achievement",
        description="Notable accomplishment with impact and recognition",
        extraction_prompt="Extract achievements including quantifiable outcomes, recognition received, and significance",
        validation_rules=["description_required", "impact_check"],
        default_ttl=timedelta(days=730),
        search_weight=1.7,
    ),
    "education": MemoryTypeConfig(
        type_name="education",
        description="Educational background including degrees, institutions, and dates",
        extraction_prompt="Extract educational history: institution name, degree, field of study, dates, GPA, honors",
        validation_rules=["name_required", "date_range_check"],
        default_ttl=timedelta(days=730),
        search_weight=1.3,
    ),
    "experience": MemoryTypeConfig(
        type_name="experience",
        description="Professional work experience with responsibilities and duration",
        extraction_prompt="Extract work experience: company, role, dates, responsibilities, achievements, technologies used",
        validation_rules=["name_required", "date_range_check"],
        default_ttl=timedelta(days=730),
        search_weight=1.5,
    ),
    "certification": MemoryTypeConfig(
        type_name="certification",
        description="Professional certification or license",
        extraction_prompt="Extract certifications: issuing body, credential name, date earned, expiration date, credential ID",
        validation_rules=["name_required", "issuer_check"],
        default_ttl=timedelta(days=365),
        search_weight=1.2,
    ),
    "publication": MemoryTypeConfig(
        type_name="publication",
        description="Published work such as articles, papers, or books",
        extraction_prompt="Extract publication details: title, authors, venue, date, DOI/URL, abstract, citations",
        validation_rules=["title_required"],
        default_ttl=timedelta(days=730),
        search_weight=1.2,
    ),
    "patent": MemoryTypeConfig(
        type_name="patent",
        description="Patent filing or grant information",
        extraction_prompt="Extract patent details: title, inventors, patent number, filing date, status, jurisdiction",
        validation_rules=["title_required", "patent_id_check"],
        default_ttl=timedelta(days=1095),
        search_weight=1.1,
    ),
    "award": MemoryTypeConfig(
        type_name="award",
        description="Honor, prize, or recognition received",
        extraction_prompt="Extract award details: award name, issuing organization, date, category, significance",
        validation_rules=["name_required"],
        default_ttl=timedelta(days=730),
        search_weight=1.3,
    ),
    "meeting": MemoryTypeConfig(
        type_name="meeting",
        description="Meeting record with attendees, agenda, and outcomes",
        extraction_prompt="Extract meeting details: subject, date, attendees, duration, key decisions, action items, notes",
        validation_rules=["date_required", "attendees_check"],
        default_ttl=timedelta(days=90),
        search_weight=1.0,
    ),
    "task": MemoryTypeConfig(
        type_name="task",
        description="Task or to-do item with priority and status",
        extraction_prompt="Extract tasks: description, assignee, due date, priority, status, dependencies",
        validation_rules=["description_required"],
        default_ttl=timedelta(days=180),
        search_weight=1.1,
    ),
    "goal": MemoryTypeConfig(
        type_name="goal",
        description="Goal or objective with targets and progress",
        extraction_prompt="Extract goals: target description, deadline, measurable outcomes, progress, milestones",
        validation_rules=["description_required", "timeline_check"],
        default_ttl=timedelta(days=365),
        search_weight=1.2,
    ),
    "preference": MemoryTypeConfig(
        type_name="preference",
        description="User preference or inclination on any topic",
        extraction_prompt="Extract preferences: topic, preferred value/option, context, stated importance, source",
        validation_rules=["topic_required"],
        default_ttl=timedelta(days=180),
        search_weight=0.8,
    ),
    "constraint": MemoryTypeConfig(
        type_name="constraint",
        description="Boundary condition or limitation on choices",
        extraction_prompt="Extract constraints: type, description, impact, source, flexibility level",
        validation_rules=["description_required"],
        default_ttl=timedelta(days=365),
        search_weight=0.9,
    ),
    "insight": MemoryTypeConfig(
        type_name="insight",
        description="Inferred understanding or synthesized knowledge",
        extraction_prompt="Extract insights: observation, implications, confidence level, supporting evidence, source context",
        validation_rules=["description_required", "evidence_check"],
        default_ttl=timedelta(days=365),
        search_weight=0.9,
    ),
    "connection": MemoryTypeConfig(
        type_name="connection",
        description="Relationship link between two entities",
        extraction_prompt="Extract connections: source entity, target entity, relationship type, strength, context, directionality",
        validation_rules=["source_required", "target_required"],
        default_ttl=timedelta(days=730),
        search_weight=0.7,
    ),
    "location": MemoryTypeConfig(
        type_name="location",
        description="Geographic place or spatial entity",
        extraction_prompt="Extract locations: name, coordinates, address, type, context of mention, temporal association",
        validation_rules=["name_required"],
        default_ttl=timedelta(days=365),
        search_weight=0.8,
    ),
    "event": MemoryTypeConfig(
        type_name="event",
        description="Calendar or scheduled occurrence",
        extraction_prompt="Extract events: name, date/time, location, organizer, attendees, description, recurrence pattern",
        validation_rules=["name_required", "date_required"],
        default_ttl=timedelta(days=365),
        search_weight=1.0,
    ),
    "document": MemoryTypeConfig(
        type_name="document",
        description="Reference to a document with its metadata and content summary",
        extraction_prompt="Extract document references: title, type, author, date, summary, key topics, file location",
        validation_rules=["title_required"],
        default_ttl=timedelta(days=730),
        search_weight=1.0,
    ),
    "conversation": MemoryTypeConfig(
        type_name="conversation",
        description="Record of a conversation or dialogue exchange",
        extraction_prompt="Extract conversation details: participants, date, topics discussed, key points, sentiment, decisions made",
        validation_rules=["date_required", "participants_check"],
        default_ttl=timedelta(days=180),
        search_weight=0.9,
    ),
}


def get_memory_type(type_name: str) -> MemoryTypeConfig | None:
    return MEMORY_TYPE_REGISTRY.get(type_name.lower())
