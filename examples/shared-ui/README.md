# Vaeloom Shared UI Components & SSE Streaming Client

This directory replaces generic web-shared presentation components with
Vaeloom's career-specific UI widgets and low-latency Server-Sent Events (SSE)
streaming client.

## Included Modules

### 1. `components.js`

Framework-agnostic presentation components designed for career intelligence:

- `renderATSScoreGauge(score, containerId)`: Animated SVG circular progress
  gauge with status thresholds (Green >=80, Amber 60-79, Red <60).
- `renderResumeDiffCard(original, tailored, containerId)`: Side-by-side diff
  card highlighting resume bullets with injected ATS keywords and impact
  metrics.
- `renderApprovalDrawer(request, onApprove, onReject, containerId)`:
  Human-in-the-Loop permission modal for mutating agent actions.
- `renderSalaryBandChart(benchmark, currentOffer, containerId)`: Interactive
  horizontal percentile bar comparing an offer against P25, Median, P75, and P90
  benchmarks.

### 2. `sse_stream_client.js`

`VaeloomStreamClient`: A zero-dependency JavaScript/TypeScript client for
streaming agent turns from `/api/v1/orchestrator/execute` or
`/api/v1/chat/stream`.

- Handles streaming event types: `thought`, `tool_call`, `tool_result`,
  `approval_required`, `final_answer`, `error`, `done`.
- Supports Bearer token authentication.
- Supports clean cancellation via `AbortController`.

## Quick Usage

```javascript
import { VaeloomStreamClient } from './sse_stream_client.js';
import { renderATSScoreGauge } from './components.js';

// 1. Render Gauge
renderATSScoreGauge(88, 'ats-gauge-container');

// 2. Stream Agent Turn
const client = new VaeloomStreamClient({
  baseUrl: 'http://localhost:8000',
  token: 'YOUR_JWT',
});
client
  .on('thought', (t) => console.log('Thinking:', t))
  .on('final_answer', (ans) => console.log('Answer:', ans))
  .on('done', () => console.log('Stream ended'));

await client.execute({
  user_id: 'usr_alex_01',
  tenant_id: 'ten_vaeloom_01',
  agent_id: 'career-agent',
  user_prompt: 'Tailor my resume for Staff Systems Engineer at Cloudflare',
});
```
