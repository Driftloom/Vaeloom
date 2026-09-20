# 18. AI Interaction Language

## 1. Zero-Hype Intelligence UX

Vaeloom rejects the conventional consumer AI aesthetic:

- **No Sparkles or "Magic" Glyphs**: We do not use magic wand or sparkle icons
  (`✨`) to represent AI computation. We use structured semantic glyphs:
  `<CpuIcon>`, `<BrainIcon>`, `<GitBranchIcon>`.
- **No "Thinking..." Without Telemetry**: Never present an indeterminate spinner
  with vague text. Always expose the active operational phase:
  `Retrieving memory entities...`, `Executing tool 'calculate_ats_score'`,
  `Evaluating constraint rules`.
- **Muted AI Accent**: AI-generated content is distinguished by a subtle
  indicator border (`var(--color-ai-border)`) and a small semantic chip
  (`AI-Synthesized`), never loud purple gradients.

## 2. Structured Agent Responses

Agent outputs are presented in structured panels containing:

1. **Header**: Agent identity, timestamp, execution duration, and confidence
   score.
2. **Payload**: The primary structured result (table, draft, plan, or analysis).
3. **Citations & Sources**: Explicit clickable citations linking to source
   documents and memory nodes.
4. **Action Bar**: Explicit human actions (`Approve`, `Modify`, `Reject`,
   `Inspect Run`).
