# ADR-029: C4 Model for Architecture Documentation

| Metadata     | Value                                     |
| ------------ | ----------------------------------------- |
| **Status**   | Accepted                                  |
| **Date**     | 2026-08-16                                |
| **Deciders** | Enterprise Architect, Documentation Lead  |
| **Owner**    | Architecture Team                         |
| **Tags**     | architecture, documentation, diagrams, c4 |

## Context

Vaeloom has 18+ architecture documents across `docs/architecture/` but lacks a
standardized diagramming approach. Different documents use different diagram
styles, notation, and abstraction levels. This makes it difficult for new
engineers to understand the system and for architects to maintain consistency.

## Decision

We will adopt the C4 Model (Context, Container, Component, Code) as the primary
architecture diagramming standard for Vaeloom.

### C4 Levels and Usage

| Level                  | Audience                        | Purpose                                  | Format              |
| ---------------------- | ------------------------------- | ---------------------------------------- | ------------------- |
| **Level 1: Context**   | Non-technical stakeholders      | System boundary and external actors      | Mermaid in Markdown |
| **Level 2: Container** | Technical leads, architects     | Deployable units and their relationships | Mermaid in Markdown |
| **Level 3: Component** | Engineers implementing features | Internal module structure                | Mermaid in Markdown |
| **Level 4: Code**      | Core module developers          | Class/interface relationships (optional) | Mermaid in Markdown |

### Implementation Rules

1. **Diagrams as Code**: All C4 diagrams use Mermaid syntax in Markdown files.
   This ensures version control, diffability, and no external tool dependency.

2. **Location**: All C4 diagrams live in `docs/architecture/C4-Architecture.md`
   with supporting detail in `docs/architecture/` subdirectories.

3. **Naming Convention**: Diagrams use consistent terminology matching the
   actual codebase:
   - `apps/web` (not "Web Application" or "Frontend")
   - `apps/api` (not "Backend Service" or "API Server")
   - `PostgreSQL 16 + pgvector` (not "Database" or "RDBMS")

4. **Status Labels**: Every diagram includes runtime status indicators:
   - ✅ OPERATIONAL — verified working
   - ⚠️ PARTIAL — implemented but incomplete
   - ❌ MISSING — documented but not implemented
   - 🚫 NOT_APPLICABLE — out of scope

5. **Legend**: Every diagram includes a legend explaining colors, shapes, and
   status indicators.

6. **Last Updated**: Every diagram includes a "Last Updated" date and the commit
   hash if significant changes were made.

## Rationale

| Alternative              | Pros                                                | Cons                           | Why Not                        |
| ------------------------ | --------------------------------------------------- | ------------------------------ | ------------------------------ |
| ad-hoc diagrams          | Low initial effort                                  | Inconsistent, unmaintainable   | —                              |
| Structurizr DSL          | More powerful, auto-generated                       | Requires Structurizr tooling   | Unnecessary complexity for MVP |
| PlantUML                 | Feature-rich                                        | Verbose syntax, harder to read | Mermaid is simpler             |
| C4 with Mermaid (chosen) | Simple syntax, version-controlled, widely supported | Limited to Mermaid's rendering | Best fit                       |

## Consequences

**Positive:**

- New engineers can understand the system in <30 minutes
- Architecture decisions are traceable to specific diagrams
- Diagrams stay in sync with code (same repo, same review process)

**Negative:**

- Initial effort to create all 4 levels (~2 days)
- Mermaid has rendering limitations for very large diagrams

**Risks:**

- Diagrams may become stale if not reviewed quarterly

## Verification

1. `docs/architecture/C4-Architecture.md` exists with all 4 levels
2. Each diagram has a legend, status labels, and last-updated date
3. Diagrams use consistent terminology matching codebase

## Related ADRs

- ADR-009: Monorepo Structure (defines container boundaries)

## Reversibility

Easy — this is a documentation standard. No code changes required.
