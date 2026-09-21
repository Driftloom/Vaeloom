# Module 05: LLM Routing, Orchestration & Structured Output
**Audit Identifier**: `AUD-M05-AI-18`
**Scope**: LLMService, model tiers (flash, pro, sonnet), provider fallbacks, and Pydantic structured output enforcement.

---

## 1. LLM Router Architecture

Implemented in `api/services/llm_service.py`:
- **Dynamic Tier Routing**:
  - `flash` (Fast, cost-effective): Used for summarization, entity tagging, and simple Q&A.
  - `pro` (Reasoning-intensive): Used for cross-document synthesis and complex conflict resolution.
- **Provider Fallback Ladder**:
  - Primary provider (e.g. Anthropic / OpenAI / Vertex AI) -> Secondary fallback -> Deterministic mock/stub fallback.
- **Structured Output**: Enforces Pydantic model schemas using JSON schema constraints and function calling.

---

## 2. Temperature & Determinism

Document synthesis requests set `temperature = 0.0` to minimize hallucination and guarantee factual fidelity to retrieved source chunks.

---

## 3. Verification Evidence

- `test_module05_llm.py`:
  - `test_llm_completion_and_fallbacks`: Verifies completion handling, mock LLM execution in CI, and fallback stability.
