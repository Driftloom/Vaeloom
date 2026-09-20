---
name: sovereign-search
description:
  Air-gapped ReAct scratchpad search playbook with zero cloud egress for local
  vLLM / Ollama deployments.
target_models: [qwen, qwen-2.5-72b, mistral, llama-3]
tools_required: [local_vector_search, query_local_sqlite]
tags: [sovereign, air-gapped, qwen, react]
examples:
  - title: Local Enterprise Search
    input: Search confidential compensation guidelines in local vector index
    output:
      Executed local embedding lookup; returned result with zero external
      network egress.
---

# Sovereign Search Playbook (Qwen / Air-Gapped ReAct Edition)

## Operational Guidelines

- **Constraint**: Strict Zero Cloud Egress. No outbound HTTP calls to
  third-party endpoints.
- All embedding computations must run on local GPU/CPU hardware.
- Use explicit ReAct scratchpads:
  ```text
  Thought: Searching internal candidate database for matching competencies...
  Action: local_vector_search
  Action Input: {"query": "Kubernetes orchestration", "limit": 5}
  Observation: [5 records retrieved]
  Final Answer: Found 5 matching candidates from the local index.
  ```
