import pytest


class TestServicesInit:
    def test_lazy_import_memory_service(self):
        from api.services import MemoryService
        assert MemoryService.__name__ == "MemoryService"

    def test_lazy_import_agent_service(self):
        from api.services import AgentService
        assert AgentService.__name__ == "AgentService"

    def test_lazy_import_llm_service(self):
        from api.services import LLMService
        assert LLMService.__name__ == "LLMService"

    def test_lazy_import_analytics_service(self):
        from api.services import AnalyticsService
        assert AnalyticsService.__name__ == "AnalyticsService"

    def test_lazy_import_audit_service(self):
        from api.services import AuditService
        assert AuditService.__name__ == "AuditService"

    def test_lazy_import_iam_service(self):
        from api.services import IamService
        assert IamService.__name__ == "IamService"

    def test_unknown_attr_raises_attribute_error(self):
        import api.services
        with pytest.raises(AttributeError, match="has no attribute"):
            api.services.NonExistentService

    def test_all_list(self):
        from api.services import __all__
        assert "MemoryService" in __all__
        assert "AgentService" in __all__
        assert "LLMService" in __all__
        assert "AnalyticsService" in __all__
        assert "AuditService" in __all__
        assert "IamService" in __all__
