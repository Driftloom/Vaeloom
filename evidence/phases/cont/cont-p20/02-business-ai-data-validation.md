# CONT-P20 — 02 Business / User / AI / Data Validation (WS-20.2, DEL-02)

## Reconciliation posture @ HEAD (criteria verified, traffic-gated execution)

- Authoritative↔projected: rebuildable projections (ADR-024) + migration
  chain with downgrade proofs; memory lineage JSONB (0027) carries
  provenance across transforms.
- Permissions/jobs/events: idempotency claims + scoped sessions + Temporal
  signal binding (all unit-proven, carried).
- AI lineage: prompt sha256 registry + model catalog pinning + judge gate
  1.0 + approval audit trail.
- KPI/SLO review: SLO 6-target ladder + cost caps + accuracy>90% via
  approval rate (definitions in `SLO.md`; live measurement needs traffic).

**Validation verdict: framework COMPLETE, live reconciliation awaits pilot
traffic (BQ-05). No synthetic contradiction found in any carried suite.**
