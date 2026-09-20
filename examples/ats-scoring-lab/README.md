# Vaeloom ATS Scoring Lab & Keyword Gap Analysis

This demo replaces generic vertical telecom demos with Vaeloom's core Applicant
Tracking System (ATS) parsing, scoring, and keyword gap analysis capabilities.

## Features

1. **Deterministic ATS Tokenization**: Normalizes resume structure and evaluates
   n-grams against job descriptions.
2. **Multi-Posting Comparative Scoring**: Evaluates candidate fit across
   distinct target roles (Cloudflare, Anthropic, Stripe) with clear
   pass/fail/review thresholds.
3. **Keyword Gap Detection**: Dissects hard technical skills and architectural
   terminology missing from the candidate's experience.
4. **Formatting & Parseability Guardrails**: Flags formatting hazards such as
   tab characters and text truncation risks that break enterprise ATS parsers
   (Workday, Greenhouse, Lever).
5. **Actionable Optimization Advice**: Generates immediate bullet point
   enhancement tips to maximize ATS match rates.

## Running the Demo

```bash
# Direct Python execution:
python examples/ats-scoring-lab/app.py

# Or via uv:
uv run --project apps/api python examples/ats-scoring-lab/app.py
```

## Architecture Integration

- **Agent**: [`agents/ats-agent`](../../agents/ats-agent)
- **Domain Service**:
  [`packages/domain/src/vaeloom_domain/ats.py`](../../packages/domain/src/vaeloom_domain/ats.py)
- **Data Fixtures**: [`examples/demo_common/data.py`](../demo_common/data.py)
