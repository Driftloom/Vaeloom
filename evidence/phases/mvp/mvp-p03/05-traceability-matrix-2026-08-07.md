# MVP-P03 — 05. Traceability Matrix (DEL-MVP-P03-03)

> Source → requirement → story → design/tests → evidence location → owner.
> Design/tests/evidence columns filled at implementation phases (P07+); P03
> records the mapping contract (prompt §23: trace, don't assume).

## Legend

- **Source:** INT-02 / INT-05 / prompt §N / P0x evidence / user decision (BQ)
- **Owner:** BA / Security / Privacy / AI / QA / Platform / UX
- **Evidence location:** `TBD_AT_IMPL` until the implementing phase fills it

| Source | Requirement | Story | Design (phase) | Tests (phase) | Evidence | Owner |
| ---------------------- | -------------------------- | -------- | ------------------ | ------------------- | ----------- | ---------------- |
| INT-02 §2; P01 | FR-01 signup+consent | US-01 | P07 data; P08 auth | P13 auth/consent | TBD_AT_IMPL | Security |
| INT-02 §2; P02 WS-02.3 | FR-02/03 profile+parse | US-02 | P07 | P12/13 eval ≥90% | TBD_AT_IMPL | AI/BA |
| BQ-P02-03 | FR-04/41 extraction ≥90% | US-03 | P07 | P13 eval suite | TBD_AT_IMPL | AI |
| INT-02 §6; FR-h66 | FR-40 Gmail polling | US-03 | P07 connector | P13 connector tests | TBD_AT_IMPL | Platform |
| INT-02 §2; NFR-h17 | FR-43 reminders | US-04 | P07 scheduler | P13 | TBD_AT_IMPL | Platform |
| INT-02 §3; ADR-009 | FR-50/51 approval | US-05 | P07/08 | P13 approval suite | TBD_AT_IMPL | Security |
| INT-02 §6.6; FR-61/62 | FR-60/61/62 export/erasure | US-06 | P07 | P13 erasure matrix | TBD_AT_IMPL | Privacy |
| NFR-15/h15 | NFR-15 isolation | US-07 | P07 schema/RLS | P13 isolation suite | TBD_AT_IMPL | Security |
| INT-02 §5; FR-h52 | NFR-10 projections | FR-11/12 | P07 | P13 rebuild tests | TBD_AT_IMPL | Architecture |
| INT-02 §5; FR-63/64 | FR-11 source-grounded | US-10 | P12 | P13 | TBD_AT_IMPL | AI |
| INT-05; P02 WS-02.1 | FR-21/22 ATS | US-11 | P12 | P13 eval | TBD_AT_IMPL | AI/BA |
| DEC-P01-03; FR-42 | US-12 drafts | US-12 | P07 | P13 | TBD_AT_IMPL | Security |
| INT-02 §3; FR-34/35 | FR-30/35 tracking | US-13 | P07 | P13 | TBD_AT_IMPL | BA |
| BQ-P02-02 (P1+P2) | FR-31 ranking | US-14 | P12 | P13 | TBD_AT_IMPL | BA |
| NFR-21/h21 | NFR-20 a11y | US-15 | P09 UX | P13 a11y | TBD_AT_IMPL | UX |
| DEC-P02-05; AUTO-02 | FR-32 T2 | US-20 | P13 | P13/15 | TBD_AT_IMPL | Platform |
| DEC-P02-05; AUTO-03 | FR-33/34 T3 | US-21/22 | P13+ | P15 | TBD_AT_IMPL | Product/Security |
| INT-02 §4; FR-h60 | NFR-16 workload identity | — | P08 | P13 | TBD_AT_IMPL | Security |
| DPDP §5/6 | NFR-17 consent | US-01 | P07 | P13 | TBD_AT_IMPL | Privacy |
| OWASP LLM Top 10 | NFR-18 injection | — | P12 | P13 injection suite | TBD_AT_IMPL | Security |
| NFR-26 | NFR-19 audit | — | P08 | P13 | TBD_AT_IMPL | Security |
| NFR-19 | NFR-21 supply chain | — | P10 CI | P14 | TBD_AT_IMPL | Platform |
| NFR-25 | NFR-22 provider config | — | P12 | P13 | TBD_AT_IMPL | Privacy |
| BQ-P02-04 | NFR-02/03 load | — | P08 | P13 load test | TBD_AT_IMPL | Platform |
