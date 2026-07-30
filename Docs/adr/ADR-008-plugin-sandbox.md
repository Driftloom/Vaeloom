# ADR-008: Subprocess Plugin Isolation

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom supports third-party plugins (tag-generator, word-count, sentiment, summarizer, translator) that execute arbitrary Python code. These plugins must be isolated from the main application process to prevent memory corruption, infinite loops, and data exfiltration. The isolation mechanism must be lightweight enough for per-request execution (plugins execute frequently) and compatible with the containerized deployment environment.

Options considered: subprocess with restricted environment, Docker-in-Docker, WebAssembly sandbox (wasmtime), gVisor, PyPy sandbox.

## Decision

Use **subprocess isolation** with resource limits and filesystem restrictions.

Mechanism:
- Each plugin executes in a `subprocess.run()` with `capture_output=True` and timeout
- Resource limits: CPU time (10s default), memory (256MB), file descriptors (64)
- Plugin code runs in a temporary directory created per execution and destroyed after
- No network access by default — plugins cannot make outbound HTTP calls unless explicitly permitted
- Plugin manifest declares required permissions (filesystem read, network, external APIs) at registration time
- Permission evaluation via `plugin_service.get_permissions()` before execution

## Consequences

**Positive:**
- Complete process isolation — plugin crash cannot bring down the main application
- Resource limits prevent infinite loops and memory exhaustion at the OS level
- No container runtime overhead — subprocess startup is <50ms vs 500ms+ for container spawn
- Plugin SDK (`packages/plugin-sdk`) provides a typed interface without exposing internal application state
- Permission system allows gradual trust elevation for verified plugins

**Negative:**
- Subprocess isolation is weaker than container-based isolation — a malicious plugin could attempt to access `/proc` or shared filesystems
- Plugin execution requires the Python runtime to be available in the execution container
- Temporary directory cleanup must be reliable to avoid disk space leaks
- Plugins cannot persist state between executions without explicit storage APIs
- No built-in network policy enforcement at the subprocess level — relies on cooperation or seccomp
