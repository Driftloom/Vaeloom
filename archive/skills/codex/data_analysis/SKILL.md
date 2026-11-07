---
name: data-analysis
description:
  OpenAI Codex & GPT function-calling playbook for Python REPL tabular data
  analysis and salary modeling.
target_models: [codex, gpt-4o, gpt-4-turbo]
tools_required: [execute_python_repl, query_data_warehouse]
tags: [analysis, python, repl, codex]
examples:
  - title: Tech Salary Percentile Curve
    input:
      Compute 25th, 50th, 75th, 90th percentile total comp for NYC Backend
      Engineers
    output:
      Executed in-process pandas script; returned structured JSON distribution
      curve.
---

# Python REPL Data Analysis Playbook (Codex Edition)

## Execution Environment

- Executes in an isolated Python subprocess sandbox with zero external network
  connectivity.
- Preloaded packages: `pandas`, `numpy`, `scipy`, `pydantic`.

## Operational Rules

1. Write clean, modular Python snippets wrapped in standard ```python blocks.
2. Store intermediate results in memory; print final summary statistics to
   stdout in JSON format.
3. Validate all inputs against strict Pydantic schemas before executing
   calculations.
