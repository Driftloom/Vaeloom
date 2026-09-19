# Security/Adversarial Testing Verification

## Purpose

Verify all 13 middleware layers, payload limits, prompt injection defenses, SSRF
protections, plugin sandboxing, and generic web vulnerabilities.

## Source of truth

- Security middlewares
- Plugin sandbox

## Preconditions

- System running with full security stack enabled.

## Test actors

- Attacker

## Test scenarios

| Action                         | Expected                                                                  | Actual     | Evidence |
| ------------------------------ | ------------------------------------------------------------------------- | ---------- | -------- |
| Submit prompt injection attack | `detect_adversarial_prompt()` blocks request                              | UNVERIFIED | TBD      |
| Upload >25MB file              | `BodySizeLimitMiddleware` rejects request                                 | UNVERIFIED | TBD      |
| Trigger SSRF via browser tool  | `assert_public_http_url` and redirect checks block access to internal IPs | UNVERIFIED | TBD      |
| Execute malicious plugin code  | Sandbox isolates subprocess, restricted globals prevent breakout          | UNVERIFIED | TBD      |
| Request MCP shell access       | Shell interpreter explicitly denied                                       | UNVERIFIED | TBD      |
| Attempt tenant breakout (IDOR) | Blocked by authorization layers                                           | UNVERIFIED | TBD      |

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
