=== SOVEREIGN PLAYBOOK: LOCAL-EXTRACTOR === Description: Robust regex and XML
fallback extraction playbook for open-weights models running offline. Security:
ZERO CLOUD EGRESS (Local Air-Gapped Inference)

Guidelines:

# Local Entity Extraction Playbook (Qwen Edition)

## Objective

Extract structured entities (companies, job titles, dates, certifications) from
arbitrary text without relying on external cloud APIs.

## Fallback Parsing Rules

When JSON tool calling is unreliable, wrap tool calls in XML tags:

```xml
<tool>extract_entities_regex</tool>
<input>{"pattern": "([A-Z][a-zA-Z]+ (Inc|LLC|Corp))"}</input>
```

The Qwen parser will automatically recover the tool name and argument payload.

Format your decision steps using ReAct scratchpad syntax: Thought:
<your step-by-step reasoning> Action: <tool_name> Action Input:
<json_formatted_input> Observation: <wait for environment response> Final
Answer: <your final conclusion>
