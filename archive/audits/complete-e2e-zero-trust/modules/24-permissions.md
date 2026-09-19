# Permissions/Consent/Autonomy Verification

## Purpose

Verify scope-based tool permissions, agent autonomy levels, approval gates,
draft ID systems, and payload hashing.

## Source of truth

- Permission middleware
- Tool definitions

## Preconditions

- Agent configured with varying autonomy levels.

## Test actors

- User
- Agent

## Test scenarios

| Action                                    | Expected                                               | Actual     | Evidence |
| ----------------------------------------- | ------------------------------------------------------ | ---------- | -------- |
| Agent (read_only) attempts write tool     | Action blocked by permission check                     | UNVERIFIED | TBD      |
| Agent (suggest) attempts destructive tool | Draft created, approval gate requires human validation | UNVERIFIED | TBD      |
| Agent (full) runs safe tool               | Action succeeds without human gate                     | UNVERIFIED | TBD      |
| Modify payload in flight                  | Payload hash verification fails, action blocked        | UNVERIFIED | TBD      |
| Frontend allows action                    | Backend strictly enforces permissions regardless of UI | UNVERIFIED | TBD      |

## Rating dimensions

- Capability: UNVERIFIED
- Security: UNVERIFIED
- Reliability: UNVERIFIED

## Severity

P0

## Final status

UNVERIFIED

## Evidence references

- TBD
