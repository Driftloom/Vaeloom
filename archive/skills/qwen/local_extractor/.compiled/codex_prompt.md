### SKILL: LOCAL-EXTRACTOR

**Description**: Robust regex and XML fallback extraction playbook for
open-weights models running offline.

#### Operational Instructions:

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

#### Reference Trajectories:

- **Unstructured Work History Extraction**:
  - Input: `Extract company names and dates from messy plain text CV`
  - Output:
    `Parsed 3 roles using hybrid regex-NER pattern; produced valid JSON entity array.`
