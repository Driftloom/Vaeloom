import importlib

__all__ = ["MemoryService", "AgentService", "LLMService", "AnalyticsService", "AuditService", "IamService"]


def __getattr__(name):
    if name == "MemoryService":
        module = importlib.import_module(".memory_service", __package__)
        return getattr(module, "MemoryService")
    if name == "AgentService":
        module = importlib.import_module(".agent_service", __package__)
        return getattr(module, "AgentService")
    if name == "LLMService":
        module = importlib.import_module(".llm_service", __package__)
        return getattr(module, "LLMService")
    if name == "AnalyticsService":
        module = importlib.import_module(".analytics_service", __package__)
        return getattr(module, "AnalyticsService")
    if name == "AuditService":
        module = importlib.import_module(".audit_service", __package__)
        return getattr(module, "AuditService")
    if name == "IamService":
        module = importlib.import_module(".iam_service", __package__)
        return getattr(module, "IamService")
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
