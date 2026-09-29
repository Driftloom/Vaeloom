# ENT-P09 — 04 Content Strategy, Microcopy & Error State Framework

> **Phase:** `ENT-P09` (UI/UX and Design System)  
> **Deliverable:** `DEL-ENT-P09-04` (v1.0)  
> **Owner:** Principal UX Content Strategist & Design Systems Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Voice, Tone & Persona Calibration

Vaeloom content communicates with precision, respect, and transparent agency:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VAELOOM CONTENT PILLARS                         │
├───────────────────────────────────┬────────────────────────────────────┤
│  1. Grounded & Empirical          │ Never exaggerate candidate skills; │
│                                   │ anchor every claim in source docs. │
├───────────────────────────────────┼────────────────────────────────────┤
│  2. Sovereign & Transparent       │ Always inform candidates when and  │
│                                   │ how their data is processed or seen│
├───────────────────────────────────┼────────────────────────────────────┤
│  3. Actionable & Direct           │ State what happened, why it matters│
│                                   │ and the exact next button to click.│
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. EU AI Act Article 50 Transparency Disclosures & Citations

To fulfill regulatory obligations under the EU Artificial Intelligence Act
(transparency for AI-assisted human evaluation) and prevent user deception:

### A. Persistent AI Attribution Badges:

Whenever generative content appears on screen, an inline badge identifies the
model tier and provenance:

```html
<span
  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
>
  <SparklesIcon class="w-3.5 h-3.5 text-indigo-500" />
  AI Tailored (Gemma 4 S2) • Grounded in Source Document
</span>
```

### B. Interactive Provenance Citation Tooltip:

Hovering or focusing on any AI-tailored resume bullet displays the authentic
source anchor:

> **"Verified Source Citation:"**  
> _Derived from "2024 Lead SRE Resume.pdf", Page 2, Lines 45–52._  
> _Extracting Agent: CareerHistoryAgent (TypeSafe Jev S1) • Checksum:
> `7f83b165...`_

---

## 3. Human-In-The-Loop (HITL) Destructive Action Confirmation Modals

Destructive actions that cannot be reversed require high-friction cognitive
confirmation dialogs:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Cryptographic Erasure Confirmation (GDPR Article 17)               │
├────────────────────────────────────────────────────────────────────────┤
│  This action permanently destroys your personal Data Encryption Key    │
│  (DEK) stored in KMS.                                                  │
│                                                                        │
│  The following records will become permanently unreadable:             │
│  • 14 Cognitive memory entries across 6 categories                     │
│  • 3 Tailored resumes and compiled PDF artifacts                       │
│  • All active advisor consent grants                                   │
│                                                                        │
│  To confirm permanent shredding, type "DELETE MY DATA" below:          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ DELETE MY DATA                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  [ Cancel (Escape) ]                  [ Permanently Shred Data (Red) ] │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. RFC 7807 Error Code to User Microcopy Translation Dictionary

Technical API errors are dynamically translated into clear, empathetic, and
actionable guidance:

| RFC 7807 Error Type   | HTTP Status | Technical API Detail      | User-Facing Display Title         | Actionable User Microcopy & Next Steps                                                                                                  |
| :-------------------- | :---------: | :------------------------ | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_EXPIRED`        |     401     | JWT expired               | **"Session Paused"**              | _"Your session timed out for your security. Please log in again to continue where you left off."_                                       |
| `PERMISSION_DENIED`   |     403     | RBAC check failed         | **"Restricted Access"**           | _"You don't have permission to view this candidate vault. An active consent grant from the candidate is required."_                     |
| `RATE_LIMIT_EXCEEDED` |     429     | Sliding window limit      | **"Generation Limit Reached"**    | _"You've reached your hourly AI tailoring limit. Your quota resets in 14 minutes. Upgrade to Pro for unlimited compilations."_          |
| `PAGE_FIT_OVERFLOW`   |     422     | Content exceeds max pages | **"Content Exceeds Page Budget"** | _"Your resume exceeds the 1-page target by 4 lines. Allow our AI page-fit optimizer to auto-condense margins, or trim 1 bullet point."_ |
| `SSRF_BLOCKED`        |     403     | Private IP blocked        | **"Invalid Job Link"**            | _"We cannot inspect links targeting internal or private network domains. Please enter a public careers page URL."_                      |
| `RESOURCE_LOCKED`     |     409     | Concurrent operation      | **"Compilation in Progress"**     | _"This resume is currently compiling a new PDF in the background. Please wait a few seconds before requesting additional edits."_       |
| `SERVER_ERROR`        |     500     | Unhandled exception       | **"Temporary System Hiccup"**     | _"Our service encountered an unexpected error. Our engineering team has been notified. Please try again in a moment."_                  |

---

_Signed: Principal UX Content Strategist & Design Systems Lead — 2026-09-29_
