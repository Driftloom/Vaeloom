import pytest
from datetime import timedelta

from api.schemas.memory_types import (
    MemoryType,
    MemoryTypeConfig,
    MEMORY_TYPE_REGISTRY,
    get_memory_type,
)


class TestMemoryTypeEnum:
    def test_all_22_types_present(self):
        assert len(MemoryType) == 22

    def test_enum_values(self):
        expected = [
            "person", "organization", "project", "skill", "achievement",
            "education", "experience", "certification", "publication",
            "patent", "award", "meeting", "task", "goal", "preference",
            "constraint", "insight", "connection", "location", "event",
            "document", "conversation",
        ]
        values = [m.value for m in MemoryType]
        assert values == expected

    def test_enum_member_names(self):
        assert MemoryType.Person.value == "person"
        assert MemoryType.Organization.value == "organization"
        assert MemoryType.Skill.value == "skill"
        assert MemoryType.Insight.value == "insight"
        assert MemoryType.Conversation.value == "conversation"


class TestMemoryTypeConfig:
    def test_config_has_all_fields(self):
        cfg = MemoryTypeConfig(
            type_name="test",
            description="test config",
            extraction_prompt="extract this",
        )
        assert cfg.type_name == "test"
        assert cfg.description == "test config"
        assert cfg.extraction_prompt == "extract this"
        assert cfg.validation_rules == []
        assert cfg.default_ttl == timedelta(days=365)
        assert cfg.search_weight == 1.0

    def test_config_custom_values(self):
        cfg = MemoryTypeConfig(
            type_name="custom",
            description="custom type",
            extraction_prompt="extract",
            validation_rules=["name_required"],
            default_ttl=timedelta(days=30),
            search_weight=2.5,
        )
        assert cfg.validation_rules == ["name_required"]
        assert cfg.default_ttl == timedelta(days=30)
        assert cfg.search_weight == 2.5


class TestMemoryTypeRegistry:
    def test_registry_has_all_types(self):
        assert len(MEMORY_TYPE_REGISTRY) == 22

    def test_registry_keys_match_enum(self):
        for member in MemoryType:
            assert member.value in MEMORY_TYPE_REGISTRY

    def test_person_config(self):
        cfg = MEMORY_TYPE_REGISTRY["person"]
        assert cfg.type_name == "person"
        assert cfg.search_weight == 1.8
        assert "name_required" in cfg.validation_rules

    def test_meeting_config(self):
        cfg = MEMORY_TYPE_REGISTRY["meeting"]
        assert cfg.type_name == "meeting"
        assert cfg.default_ttl == timedelta(days=90)
        assert "date_required" in cfg.validation_rules

    def test_meeting_short_ttl(self):
        cfg = MEMORY_TYPE_REGISTRY["meeting"]
        assert cfg.default_ttl < timedelta(days=365)

    def test_patent_long_ttl(self):
        cfg = MEMORY_TYPE_REGISTRY["patent"]
        assert cfg.default_ttl >= timedelta(days=1095)

    def test_preference_low_weight(self):
        cfg = MEMORY_TYPE_REGISTRY["preference"]
        assert cfg.search_weight < 1.0

    def test_person_high_weight(self):
        cfg = MEMORY_TYPE_REGISTRY["person"]
        assert cfg.search_weight > 1.5


class TestGetMemoryType:
    def test_get_existing_type(self):
        cfg = get_memory_type("skill")
        assert cfg is not None
        assert cfg.type_name == "skill"

    def test_get_type_case_insensitive(self):
        cfg = get_memory_type("SKILL")
        assert cfg is not None
        assert cfg.type_name == "skill"

    def test_get_type_case_mixed(self):
        cfg = get_memory_type("Achievement")
        assert cfg is not None
        assert cfg.type_name == "achievement"

    def test_get_non_existent(self):
        cfg = get_memory_type("nonexistent")
        assert cfg is None

    def test_get_empty_string(self):
        cfg = get_memory_type("")
        assert cfg is None

    def test_get_none_raises(self):
        with pytest.raises(AttributeError):
            get_memory_type(None)  # type: ignore[arg-type]
