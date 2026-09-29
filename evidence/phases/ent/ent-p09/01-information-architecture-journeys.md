# ENT-P09 — 01 Information Architecture & User Journeys

> **Phase:** `ENT-P09` (UI/UX and Design System)  
> **Deliverable:** `DEL-ENT-P09-01` (v1.0)  
> **Owner:** Principal UX Architect & Product Design Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Dual-Experience Architectural Framework

To honor candidate data sovereignty while providing powerful governance tools
for institutions, Vaeloom establishes two distinct, isolated visual and
navigational experiences:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VAELOOM USER INTERFACE                          │
├───────────────────────────────────┬────────────────────────────────────┤
│   CANDIDATE SOVEREIGN VAULT UX    │   INSTITUTIONAL CONTROL PLANE UX   │
│  - Tone: Empowering, Focused, Warm│  - Tone: Analytical, Dense, Crisp  │
│  - Purpose: Career Growth & Agency│  - Purpose: Governance & Oversight │
│  - Persona: Students, Job Seekers │  - Persona: Career Directors, Admins│
│  - Palette: Indigo, Slate, Emerald│  - Palette: Navy, Zinc, Amber      │
│  - Data Boundary: Private by def. │  - Data Boundary: Aggregate / Grant│
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Global Site Map & Navigational Hierarchy

```mermaid
graph TD
    Root[Global Gateway /] --> Pub[Public Surface]
    Root --> AuthFlow[Auth / SSO Gateway]
    Root --> App[Authenticated Application]

    Pub --> Land[Landing Page /]
    Pub --> Pricing[Pricing & Plans]
    Pub --> Templates[Public Template Gallery]

    AuthFlow --> Login[Login / SSO Callback]
    AuthFlow --> Signup[Candidate Registration]
    AuthFlow --> MFA[TOTP / WebAuthn Challenge]

    App --> CandApp[Candidate Sovereign Portal]
    App --> InstApp[Institutional Admin Portal]

    subgraph CandidatePortal["Candidate Sovereign Portal (/workspace/:id)"]
        CandApp --> Dash[Overview & Quick Actions]
        CandApp --> Resumes[Resume Builder & Live Preview]
        CandApp --> Jobs[Job Match & Market Tracker]
        CandApp --> Chat[AI Career Coaching Stream]
        CandApp --> Mem[22-Type Cognitive Memories]
        CandApp --> Council[Multi-Agent Advisory Council]
        CandApp --> VaultSettings[Sovereign Vault & Consent Grants]
    end

    subgraph InstitutionalPortal["Institutional Admin Portal (/admin)"]
        InstApp --> InstDash[Cohort Metrics & Placement KPIs]
        InstApp --> Members[Roster Management & SCIM Groups]
        InstApp --> Advisors[Advisor Role Delegation]
        InstApp --> Audit[Partitioned Agent Audit Logs]
        InstApp --> Billing[Seat Licensing & Quota Allocation]
    end
```

---

## 3. End-to-End Core User Journeys

### Journey 1: Candidate Sovereign Onboarding & Resume Ingestion

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant UI as Onboarding Wizard (/onboarding)
    participant API as FastAPI Backend
    participant MinIO as MinIO S3 Vault
    participant Extractor as Memory Extraction Agent

    Candidate->>UI: Select Target Role (e.g., Senior Platform Engineer)
    Candidate->>UI: Upload Existing Resume PDF
    UI->>API: POST /resumes/upload (Multipart FormData)
    API->>MinIO: Encrypt & Store Artifact (AES-256-GCM)
    API->>Extractor: Enqueue extraction job to BullMQ
    Extractor-->>UI: Real-Time SSE Stream (Extracted 14 Skills, 3 Roles)
    UI->>Candidate: Interactive Verification Card (Confirm/Edit Extracted Facts)
    Candidate->>UI: Click "Certify Sovereign Memory"
    UI->>API: POST /memories/batch-confirm
    API-->>UI: 200 OK (Sovereign Vault Initialized)
```

### Journey 2: AI Agent Resume Tailoring with Grounded Provenance & Live PDF Fit

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant UI as Resume Builder (/resumes/:id)
    participant Tailor as AI Tailoring Agent (Gemma 4 S2)
    participant Playwright as Headless Chromium Pool

    Candidate->>UI: Paste Target Job Description (URL or Text)
    Candidate->>UI: Click "AI Tailor & Optimize"
    UI->>Tailor: POST /resumes/:id/tailor
    Tailor-->>UI: Stream Tailored Bullet Points with <provenance> Citations
    UI->>UI: Render Side-by-Side Diff (Original vs Tailored)
    Candidate->>UI: Click "Compile to PDF"
    UI->>Playwright: POST /resumes/:id/compile (Target: Max 1 Page)
    Note over Playwright: Page-fit loop dynamically scales padding & line-height
    Playwright-->>UI: Binary PDF Stream (1 Exact Page Budget Verified)
    UI-->>Candidate: Live In-Browser PDF Preview + One-Click Download
```

### Journey 3: Candidate Granular Consent Grant to Institutional Career Advisor

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    actor Advisor as Career Advisor
    participant UI as Sovereign Settings (/settings/consent)
    participant API as FastAPI Backend
    participant DB as PostgreSQL 16 (RLS)

    Advisor->>Candidate: Request Review Access for "Fall 2026 Tech Resume"
    Candidate->>UI: Notification Alert: "Advisor Jane Doe requests review access"
    Candidate->>UI: Configure Consent Grant (Select: Specific Resume only, Duration: 7 days)
    Candidate->>UI: Click "Sign & Grant Time-Bounded Access"
    UI->>API: POST /account/consent-grants
    API->>DB: INSERT INTO consent_grants (expires_at = now + 7d)
    API-->>Advisor: Webhook / SSE: "Consent Granted for Candidate #4491"
    Note over DB: PostgreSQL RLS allows Advisor query ONLY during active grant window
```

---

_Signed: Principal UX Architect & Product Design Lead — 2026-09-29_
