# 21. Provenance & Citations

## 1. Provenance Principle

Every piece of synthetic knowledge, summary, or agent recommendation must
provide direct, verifiable provenance. "Hallucination" is mitigated through
visual accountability.

## 2. Citation Components

- `<SourceCitation>`: Inline bracketed number `[1]` or contextual chip
  `[Notion: Q3 Roadmap]` that:
  - On hover: Displays a lightweight tooltip with excerpt, document title, and
    timestamp.
  - On click: Opens the source inspector drawer or navigates directly to the
    original connector artifact.
- `<ConfidenceIndicator>`: Muted tabular metric badge showing retrieval
  similarity or LLM evaluation score:
  - High: `≥ 85%` (Neutral subtle or Emerald dot)
  - Medium: `70% - 84%` (Amber dot)
  - Low / Extrapolated: `< 70%` (Rose dot with warning: "Needs human
    verification")
