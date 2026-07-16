# ⚠️ DEPRECATED — Do Not Edit

> **Status:** 🗄️ Deprecated / Archived
> **Last Updated:** 2026-07-16
> **Canonical source:** [`../Docs/`](../Docs/) — the live documentation system

## This folder is no longer the source of truth

Everything under `Documents/` is **deprecated** as of 2026-07-16. The canonical,
enterprise-grade documentation for the Vaeloom project lives in **[`../Docs/`](../Docs/)**.

This folder is retained only for historical reference and to preserve git history.
**Do not edit files here.** Any change made here will be invisible to CI, the docs
portal, and the rest of the engineering organization.

## What happened

Earlier passes of the documentation effort produced parallel trees:

| Folder | Role |
|--------|------|
| **`Docs/`** | ✅ **Canonical.** 218+ files across 16 enterprise categories, 100% Mermaid coverage, audited. |
| `Documents/` | 🗄️ Legacy. Earlier composite specs + build prompts. Superseded. |
| `Documents/Archived/` | 🗄️ Archived. Even older copies of the build prompts. |

### Where the content went

- **Build prompts** (`00-master-build-order.md` … `17-agent-orchestration-at-scale.md`,
  both MVP and Enterprise sets) → [`../Docs/Engineering/Implementation/`](../Docs/Engineering/Implementation/).
  The Enterprise-only `17-agent-orchestration-at-scale.md` was the last unique file in this
  tree and has been promoted to the canonical Implementation folder.
- **`01-`–`06-` numbered specs** → superseded by the categorized docs under `Docs/`
  (e.g. `Docs/Product/`, `Docs/Architecture/`, `Docs/AI/`).
- **`Vaeloom-Complete-Documentation.md`, `Vaeloom-Documentation-Site.md`,
  `Vaeloom-How-It-Works-Visual.md`, `Vaeloom-Enterprise-Paper.md`** → superseded by the
  categorized docs and the interactive portal at `Docs/Documentation-Dashboard.html`.

## If you got here from an old link

Update your link to point at the corresponding file under [`../Docs/`](../Docs/). The master
index is [`../Docs/README.md`](../Docs/README.md). For a full map of what lives where, see
[`../Docs/00-DOCUMENTATION-COMPLETION-REPORT.md`](../Docs/00-DOCUMENTATION-COMPLETION-REPORT.md).

## Related Documents

- [`../Docs/`](../Docs/) — canonical documentation system
- [`../Docs/README.md`](../Docs/README.md) — master index
- [`../Docs/00-GAP-ANALYSIS-REPORT.md`](../Docs/00-GAP-ANALYSIS-REPORT.md) — why this consolidation happened
