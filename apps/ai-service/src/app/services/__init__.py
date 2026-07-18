import importlib

__all__ = ["MemoryService", "AgentService", "LLMService"]


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
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
