# 07 — MCP & Tool Ecosystem (Enterprise upgrade)

## Read first
`mvp/07-mcp-tool-ecosystem.md`. MVP already built every tool MCP-shaped — this phase is where that bet pays off: wiring real MCP transport and opening the ecosystem to third parties.

## Objective
Wire actual MCP protocol transport (both consuming external MCP servers and exposing Vaeloom's own), ship the Plugin SDK publicly, and launch a Marketplace.

## Requirements
- **Real MCP transport:** implement the MCP client (so Vaeloom can consume any compliant external MCP server — a company's internal Jira, a research database — as a connector with zero custom integration code) and MCP server (so Vaeloom's own agents/memory can be called from other environments a user already works in, under the same permission model as everything else). This should be close to a pure transport swap under the `Tool.call()` interface from MVP — if it isn't, that's a sign MVP's tool shape wasn't MCP-compatible enough and needs revisiting, not a sign this phase needs a workaround.
- **Capability discovery/negotiation, formalized:** MVP's `capabilities` field on `Tool` (streaming, idempotency) becomes real protocol-level discovery — when Vaeloom connects to an external MCP server, it queries what that server actually supports before ever attempting a call, and the calling agent's Plan phase (file 05) can branch on what's available rather than assuming and failing.
- **Tool-level circuit breaking for third-party plugins:** a Marketplace plugin that fails repeatedly (distinct from the agent-level circuit breaking in `17-agent-orchestration-at-scale.md`, which is about agents, not the tools they call) is automatically suspended from being called until a maintainer reviews it — third-party tools are inherently less trusted than first-party connectors, and a failing plugin should not be retried indefinitely against a live user request.
- **Public Plugin SDK release:** harden `packages/plugin-sdk` (MVP built the seam, not the polish) — documentation, versioning, a local test harness simulating the Permission Engine so third-party developers can verify their plugin respects declared scopes before submission.
- **Marketplace (`apps/web/marketplace`, backing API in `apps/api`):** discovery, review/approval workflow, and a revenue-share model for third-party plugins. Every submitted plugin runs in the sandboxed execution context (file 11) with zero access beyond its declared manifest scopes — no exceptions for "trusted" partners.
- **Remote/local MCP server support:** distinguish and support both — a remote MCP server (hosted, OAuth-authenticated) and a local one (e.g. a company's on-prem system reachable only from within their network) — the connector configuration model needs to represent both cleanly.

## Out of scope
Any change to the tool contract shape itself (`mvp/07-mcp-tool-ecosystem.md`'s `Tool` class) — if this phase requires changing that shape, it's a sign of a gap in the MVP design that should be fixed at the source, not patched around here.

## Acceptance criteria
- [ ] Vaeloom successfully consumes a real third-party MCP server as a connector with no custom integration code beyond configuration.
- [ ] A third-party developer, using only the public SDK and its documentation, successfully builds and submits a working plugin without needing to read Vaeloom's internal source.
- [ ] A submitted Marketplace plugin attempting to access a scope outside its manifest is blocked by the sandbox, verified by an adversarial test plugin.
- [ ] Both a remote and a local MCP server connect and function correctly in a test environment.
- [ ] Connecting to an external MCP server with limited capabilities correctly informs the calling agent's Plan phase, which branches its approach rather than attempting an unsupported call and failing.
- [ ] A Marketplace plugin forced to fail repeatedly in a test is automatically suspended from further calls and requires manual maintainer reset, rather than being retried indefinitely.
