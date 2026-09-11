# Application Workflow Verification

## Purpose

Verify the end-to-end job application workflow, including agent approval gates,
tailored asset generation (resume, cover letter), duplicate detection, tracking,
and external platform compliance.

## Source of truth

- Source Code
- Architecture Documents

## Preconditions

- User has uploaded a base resume and profile data.
- Job postings exist in the system.
- Application tracking database is empty.

## Test actors

- Candidate (User)
- Application Agent

## Test scenarios

| Action                                    | Expected                                           | Actual     | Evidence |
| ----------------------------------------- | -------------------------------------------------- | ---------- | -------- |
| Agent initiates application process       | Approval gate triggered; no external action taken  | UNVERIFIED | TBD      |
| User approves application draft           | Agent generates tailored resume and cover letter   | UNVERIFIED | TBD      |
| Agent attempts to apply to same job twice | Duplicate detection blocks second attempt          | UNVERIFIED | TBD      |
| Review tailored assets                    | Assets match job description requirements          | UNVERIFIED | TBD      |
| Application submission                    | Status updated to 'Applied', career memory updated | UNVERIFIED | TBD      |
| Check external platform compliance        | Application conforms to rate limits and API terms  | UNVERIFIED | TBD      |

## Rating dimensions

- Capability: UNVERIFIED
- Security: UNVERIFIED
- Reliability: UNVERIFIED

## Severity

P1

## Final status

UNVERIFIED

## Evidence references

- TBD
