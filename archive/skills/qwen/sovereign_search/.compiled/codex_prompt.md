### SKILL: SOVEREIGN-SEARCH

**Description**: Air-gapped ReAct scratchpad search playbook with zero cloud
egress for local vLLM / Ollama deployments.

#### Operational Instructions:

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

#### Reference Trajectories:

- **Local Enterprise Search**:
  - Input: `Search confidential compensation guidelines in local vector index`
  - Output:
    `Executed local embedding lookup; returned result with zero external network egress.`
