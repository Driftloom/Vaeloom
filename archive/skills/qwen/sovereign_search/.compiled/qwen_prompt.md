=== SOVEREIGN PLAYBOOK: SOVEREIGN-SEARCH === Description: Air-gapped ReAct
scratchpad search playbook with zero cloud egress for local vLLM / Ollama
deployments. Security: ZERO CLOUD EGRESS (Local Air-Gapped Inference)

Guidelines:

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

Format your decision steps using ReAct scratchpad syntax: Thought:
<your step-by-step reasoning> Action: <tool_name> Action Input:
<json_formatted_input> Observation: <wait for environment response> Final
Answer: <your final conclusion>
