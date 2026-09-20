# Vaeloom Interview Preparation & Salary Intelligence Co-Pilot

This demo replaces legacy travel booking examples with Vaeloom's Career
Intelligence features: salary benchmarking, offer counter-negotiation, and STAR
behavioral interview assessment.

## Features

1. **Compensation Benchmarking**: Queries deterministic market compensation data
   across geographical tech hubs (SF, NYC, Remote) spanning P25, Median, P75,
   and P90 tiers.
2. **Counter-Offer Negotiation Generator**: Evaluates employer offers against
   75th-percentile market data and synthesizes tailored negotiation
   counter-scripts and equity rebalancing proposals.
3. **STAR Method Mock Interview Evaluator**: Parses and scores
   behavioral/technical interview answers against Situation, Task, Action, and
   Result rubrics, giving candidates actionable critique prior to onsite loops.

## Running the Demo

```bash
# Direct Python execution:
python examples/interview-intelligence/app.py

# Or via uv:
uv run --project apps/api python examples/interview-intelligence/app.py
```

## Architecture Integration

- **Domain Services**:
  [`packages/domain/src/vaeloom_domain/salary.py`](../../packages/domain/src/vaeloom_domain/salary.py)
- **Data Fixtures**: [`examples/demo_common/data.py`](../demo_common/data.py)
