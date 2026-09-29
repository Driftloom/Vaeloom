# DEL-ENT-P17-05 — EU AI Act Transparency & Responsible AI Governance

**Deliverable ID:** DEL-ENT-P17-05  
**Phase:** ENT-P17 — Observability and Operations  
**Version:** 1.0.0  
**Owner:** AI Safety Lead + Legal Reviewer  
**Reviewer:** CISO + Product Lead  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p17/05-eu-ai-act-transparency.md`

---

## 1. EU AI Act Article 50 Compliance & Transparency Banner

In accordance with **EU AI Act Regulation (EU) 2024/1689 (Article 50 -
Transparency obligations for providers and deployers of certain AI systems)**,
Vaeloom provides persistent, clear disclosure across all user-facing interfaces:

```tsx
// Frontend Banner Implementation: apps/web/src/components/ai/AITransparencyBanner.tsx
export function AITransparencyBanner() {
  return (
    <div className="bg-slate-900 border-l-4 border-indigo-500 p-3 text-xs text-slate-300 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span>
          <strong>AI-Assisted Career System:</strong> Content, analysis, and
          agent recommendations are generated using governed AI models (TypeSafe
          AI & Gemma 4). Decisions remain under human control.
        </span>
      </div>
      <Link
        href="/privacy/ai-governance"
        className="text-indigo-400 underline hover:text-indigo-300"
      >
        Learn about AI transparency & your rights
      </Link>
    </div>
  );
}
```

---

## 2. AI Risk Tier Classification (EU AI Act Assessment)

| Vaeloom AI Capability            | Underlying Model   | Risk Classification | Justification & Controls                                             |
| -------------------------------- | ------------------ | ------------------- | -------------------------------------------------------------------- |
| **Resume ATS Tailoring**         | Ollama Gemma 4 31B | **Limited Risk**    | Transparency banner + user approval required before saving           |
| **Action & Tool Routing**        | TypeSafe AI Jev S1 | **Minimal Risk**    | Deterministic mathematical routing; no biometric or hiring decisions |
| **Job Search Semantic Matching** | pgvector HNSW      | **Minimal Risk**    | Read-only vector search over public job postings                     |
| **Destructive Action HITL Gate** | TypeSafe AI Jev S1 | **Limited Risk**    | Mandatory HMAC-signed human approval for all Tier 4 tools            |
| **Career Coaching Chat**         | Gemma 4 31B        | **Limited Risk**    | Grounded context fencing; no automated decision making               |
| **Institutional Analytics**      | Aggregate SQL      | **Minimal Risk**    | Zero PII; ConsentGrant strictly enforced                             |

---

## 3. Human Oversight & Model Governance Framework

1. **Human-in-the-Loop (HITL):** No consequential action (e.g. submitting an
   external job application, deleting memories, altering permissions) occurs
   without explicit candidate cryptographic sign-off.
2. **Provenance Watermarking:** All generated resume artifacts carry invisible
   metadata tags documenting the generator model, prompt template hash, and
   generation timestamp.
3. **Right to Explanation:** Users can view the exact reasoning steps and tool
   calls executed by autonomous agents in the ReAct inspection modal.

---

_Deliverable DEL-ENT-P17-05 v1.0.0 — AI Safety Lead — 2026-09-29_
