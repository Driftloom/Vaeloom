# Finding: Desktop Companion and VS Code Extension Don't Exist

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **ID**       | FIND-DOC-001                     |
| **Severity** | P1-HIGH                          |
| **Status**   | OPEN                             |
| **Source**   | Documentation Audit              |
| **File**     | `docs/02-system-architecture.md` |

## Description

`02-system-architecture.md` depicts a "Desktop Companion" (scoped local-folder
access) and "VS Code Extension" (workspace + git activity) as Layer 01 interface
components alongside the implemented Web App. Neither exists anywhere in the
codebase. Zero code, zero config, zero references.

## Evidence

- No Electron app
- No desktop companion directory
- No VS Code extension manifest or code
- No `.vscode/` folder with extension config

## Impact

-误导new engineers about platform capabilities

- May influence product decisions based on fictional features

## Remediation

Mark as `STATUS: ASPIRATIONAL` or `STATUS: PLANNED` with explicit timeline.
