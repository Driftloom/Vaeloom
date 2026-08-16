# Finding: Synchronous Disk Writes in Agent Loop

| Metadata     | Value                                           |
| ------------ | ----------------------------------------------- |
| **ID**       | FIND-ORCH-004                                   |
| **Severity** | P2-MEDIUM                                       |
| **Status**   | OPEN                                            |
| **Source**   | Orchestrator Loop Audit                         |
| **File**     | `apps/api/src/api/orchestrator/loop.py:260-280` |

## Description

`save_checkpoint()` writes to disk synchronously 4 times per iteration (12 times
total in 3 iterations). Each call uses `file.write_text()`. For high-throughput
systems, this is a bottleneck. The state dir `~/.vaeloom/state/` is user-local,
not suitable for containerized deployments.

## Impact

- 12 synchronous I/O operations per agent loop run
- Not suitable for Kubernetes/containerized deployments
- State is lost if container restarts (local filesystem)

## Remediation

1. Use async file I/O or Redis for checkpoint storage
2. Make checkpoint frequency configurable (e.g., every N iterations)
3. For production, use PostgreSQL-backed state persistence
