# Vaeloom Resume Studio & Compilation Demo

This demo illustrates Vaeloom's signature AI resume compilation and tailoring
pipeline, replacing generic consumer storefront examples with core platform
functionality.

## Features

1. **Multi-Template Layout Registry**: Supports `modern`, `executive`,
   `technical`, and `compact` industry templates.
2. **Deterministic Page-Fit Loop**: Automatically calculates content height
   units against standard printable page capacity (US Letter), auto-adjusting
   font point sizes and line-heights in 0.5pt increments to guarantee strict
   1-page or 2-page budget compliance without overflowing.
3. **AI Keyword Tailoring**: Injects relevant technical keywords and
   achievements matched to the target company's job description.
4. **Multi-Format Artifact Delivery**: Prepares downloadable compilation
   payloads for PDF, DOCX, and JSON schema targets.

## Running the Demo

```bash
# Direct Python execution:
python examples/resume-studio/app.py

# Or via uv:
uv run --project apps/api python examples/resume-studio/app.py
```

## Architecture Integration

- **Agent**: [`agents/resume-agent`](../../agents/resume-agent)
- **Domain Services**: [`packages/domain`](../../packages/domain)
- **Data Fixtures**: [`examples/demo_common/data.py`](../demo_common/data.py)
