# Load Tests

[k6](https://k6.io) scripts for Vaeloom backend performance testing.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed
- Backend server running (`pnpm dev:be` or `make dev-backend`)

## Quick Start

```bash
# Default test (50 VUs, 5min ramp)
k6 run k6-script.js

# Custom endpoint and credentials
k6 run -e BASE_URL=http://localhost:8000 \
  -e TEST_EMAIL=loadtest@vaeloom.test \
  -e TEST_PASSWORD=LoadTest1234! \
  k6-script.js

# Run with output to JSON
k6 run --out json=results.json k6-script.js

# Run with summary report
k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" k6-script.js
```

## Scenarios

| Scenario | VUs | Duration | Endpoints |
|----------|-----|----------|-----------|
| Default | 50 | 5min | login, workspaces, memories, graph edges |

## Thresholds

| Metric | Threshold |
|--------|-----------|
| p95 latency | < 500ms |
| Error rate | < 1% |
| Per-endpoint errors | < 1% |

## Writing Tests

Create additional `.js` files in this directory with `export default function () { ... }`.
Use `groups` to organize related endpoints. Add custom metrics for fine-grained monitoring.
