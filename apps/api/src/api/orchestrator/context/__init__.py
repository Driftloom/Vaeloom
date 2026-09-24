"""Context Boundary & XML Fencing Subsystem.

Provides zero-trust context isolation for LLM inference prompts.
"""

from .context_assembler import ContextAssembler, context_assembler

__all__ = ["ContextAssembler", "context_assembler"]
