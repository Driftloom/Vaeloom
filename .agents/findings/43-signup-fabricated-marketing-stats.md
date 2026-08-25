# 43 — [P2] Signup page displays fabricated marketing stats ("10K+ users", "99.9% uptime")

**Date:** 2026-08-23 · **Severity: P2** · **Status: OPEN**

## Evidence

`apps/web/src/app/(auth)/signup/page.tsx:151-160` renders to unauthenticated
visitors:

- `"10K+"` Active users
- `"8"` AI Agents
- `"99.9%"` Uptime

plus unverifiable "Join thousands" copy at `:146`.

This is the last survivor of the Phase-01 F-02 fabrication cluster (all other
surfaces verified remediated: billing card removed, admin quick-actions
disabled, status uptime "Not reported", marketplace metrics honest).

In a trust-first product these are invented system facts presented as fact.

## Fix direction

Replace with honest copy (product principles, agent count from real registry
length if desired, no user/uptime claims until telemetry exists).
