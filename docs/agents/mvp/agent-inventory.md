# MVP Agent Inventory

> **Purpose:** Define the 8 MVP AI agents, their capabilities, and execution patterns
> **Status:** ✅ Upgraded to enterprise quality
> **Owner:** AI Team
> **Version:** 2.0
> **Last Updated:** 2026-07-17

## Agent Architecture

```mermaid
graph TD
    subgraph MVP["MVP Agents (8)"]
        A1["Document Ingestion Agent"]
        A2["Auto-Organization Agent"]
        A3["Deadline Detection Agent"]
        A4["Job Search Agent"]
        A5["Tailored Application Agent"]
        A6["Master Resume Agent"]
        A7["Memory Graph Agent"]
        A8["Gmail Digest Agent"]
    end

    subgraph Services["Backing Services"]
        S1["Memory Store"]
        S2["Knowledge Graph"]
        S3["Document Parser"]
        S4["Search Index"]
    end

    A1 --> S1 & S3
    A2 --> S2
    A7 --> S2 & S4
    A3 & A4 & A5 & A6 & A8 --> S1
```

## Agent Summary

| # | Agent | Category | Model | Memory | Schedule |
|---|-------|----------|-------|--------|----------|
| 1 | Document Ingestion | Ingestion | Claude Sonnet | Write | Event-driven |
| 2 | Auto-Organization | Memory | Claude Sonnet | Read/Write | Daily |
| 3 | Deadline Detection | Analysis | Claude Haiku | Read | Hourly |
| 4 | Job Search | Retrieval | Claude Sonnet | Read | Daily |
| 5 | Tailored Application | Action | Claude Sonnet | Read/Write | On-demand |
| 6 | Master Resume | Memory | Claude Sonnet | Read/Write | On-demand |
| 7 | Memory Graph | Memory | Claude Haiku | Read | Event-driven |
| 8 | Gmail Digest | Communication | Claude Sonnet | Read | Weekly |
