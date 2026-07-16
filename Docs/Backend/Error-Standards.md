# Error Standards

> **Purpose:** Define the unified error handling standard for all Vaeloom APIs — error envelope format, code taxonomy, HTTP status mapping, and AI-specific error codes
> **Status:** 🆕 New
> **Owner:** Architecture Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16
> **Dependencies:** [`REST-Standards.md`](./REST-Standards.md), [`Validation.md`](./Validation.md), [`API-Reference.md`](./API-Reference.md), [`../AI/Guardrails.md`](../AI/Guardrails.md)
> **Implementation Status:** 📋 Spec Only

## Overview

Errors are a first-class API surface. A well-designed error response tells the client exactly what went wrong, why, and how to fix it — without leaking implementation details. This document defines the single error envelope every Vaeloom API returns, the taxonomy of error codes, HTTP status mapping, and AI-specific failure modes. Every endpoint, in every service, must conform to this standard.

## Goals

- Define the canonical error response envelope
- Establish the error code taxonomy and naming convention
- Map error codes to HTTP status codes
- Define AI-specific error codes
- Specify error logging and trace correlation

## Scope

### In Scope

- Error response envelope format
- Error code taxonomy
- HTTP status mapping
- Field-level validation error structure
- AI-specific error codes
- Error logging and trace correlation

### Out of Scope

- Validation rules (see [`Validation.md`](./Validation.md))
- Rate limiting behavior (see [`Rate-Limiting.md`](./Rate-Limiting.md))

## Error Envelope

Every error response uses this exact structure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request was invalid.",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Email must be a valid address."
      }
    ],
    "trace_id": "trace_abc123",
    "timestamp": "2026-07-16T10:00:00.000Z",
    "documentation_url": "https://docs.vaeloom.dev/errors/VALIDATION_FAILED"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `error.code` | string | Yes | Machine-readable error code (UPPER_SNAKE_CASE) |
| `error.message` | string | Yes | Human-readable summary (safe to show users) |
| `error.details` | array | No | Field-level validation errors (present for 400 responses) |
| `error.trace_id` | string | Yes | Correlates to distributed trace; include in support requests |
| `error.timestamp` | string | Yes | ISO 8601 timestamp of when the error occurred |
| `error.documentation_url` | string | No | Link to error documentation |

## Error Code Taxonomy

### Authentication Errors (AUTH_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `AUTH_REQUIRED` | 401 | Authentication is required. | No token provided |
| `AUTH_TOKEN_INVALID` | 401 | The authentication token is invalid. | Malformed or expired JWT |
| `AUTH_TOKEN_EXPIRED` | 401 | The authentication token has expired. | JWT exp claim passed |
| `AUTH_MFA_REQUIRED` | 401 | Multi-factor authentication is required. | MFA enforced but not completed |
| `AUTH_PERMISSION_DENIED` | 403 | You do not have permission to perform this action. | RBAC/ABAC check failed |

### Validation Errors (VALIDATION_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `VALIDATION_FAILED` | 400 | The request was invalid. | One or more fields failed validation |
| `VALIDATION_FIELD_REQUIRED` | 400 | A required field is missing. | Missing required field |
| `VALIDATION_FIELD_TOO_LONG` | 400 | A field exceeds the maximum length. | String too long |
| `VALIDATION_INVALID_FORMAT` | 400 | A field has an invalid format. | Email, URL, UUID format mismatch |
| `VALIDATION_INVALID_ENUM` | 400 | A field has an invalid value. | Value not in allowed enum |

### Resource Errors (RESOURCE_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `RESOURCE_NOT_FOUND` | 404 | The requested resource was not found. | ID doesn't exist |
| `RESOURCE_CONFLICT` | 409 | The resource already exists or conflicts. | Duplicate unique constraint |
| `RESOURCE_GONE` | 410 | The resource has been deleted. | Soft-deleted resource accessed |

### Rate Limit Errors (RATE_LIMIT_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests. | Rate limit hit |
| `RATE_LIMIT_QUOTA_EXCEEDED` | 402 | Usage quota exceeded. | Plan limit reached |

### AI-Specific Errors (AI_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `AI_MODEL_TIMEOUT` | 504 | The AI model did not respond in time. | LLM inference timeout |
| `AI_MODEL_UNAVAILABLE` | 503 | The AI model is currently unavailable. | LLM provider down or rate-limited |
| `AI_GUARDRAIL_BLOCKED` | 422 | The request was blocked by safety guardrails. | Input/output failed safety check |
| `AI_AGENT_FAILED` | 500 | The agent encountered an error during execution. | Agent exception |
| `AI_CONTEXT_TOO_LONG` | 413 | The input exceeds the model's context window. | Token count over limit |
| `AI_AGENT_NOT_AVAILABLE` | 400 | The requested agent is not available. | Agent disabled or not installed |

### Tenant Errors (TENANT_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `TENANT_NOT_FOUND` | 404 | The tenant was not found. | Invalid tenant_id |
| `TENANT_SUSPENDED` | 403 | The tenant is suspended. | Write on suspended tenant |
| `TENANT_PROVISIONING` | 409 | The tenant is still being provisioned. | Provisioning in progress |
| `TENANT_SEAT_LIMIT_EXCEEDED` | 402 | The tenant has reached its seat limit. | Seat count exceeded |

### Internal Errors (INTERNAL_*)

| Code | HTTP | Message | When |
|------|------|---------|------|
| `INTERNAL_ERROR` | 500 | An internal error occurred. | Unhandled exception |
| `INTERNAL_SERVICE_UNAVAILABLE` | 503 | A required service is unavailable. | Downstream service down |
| `INTERNAL_BAD_GATEWAY` | 502 | An upstream service returned an error. | Invalid upstream response |

## Field-Level Validation Details

For `VALIDATION_FAILED` (400) responses, the `details` array contains per-field errors:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request was invalid.",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Email must be a valid address."
      },
      {
        "field": "password",
        "code": "FIELD_TOO_SHORT",
        "message": "Password must be at least 12 characters."
      }
    ],
    "trace_id": "trace_abc123",
    "timestamp": "2026-07-16T10:00:00.000Z"
  }
}
```

## HTTP Status Code Mapping

| Status | Meaning | Vaeloom Usage |
|--------|---------|---------------|
| 400 | Bad Request | Validation errors, malformed JSON |
| 401 | Unauthorized | Missing/invalid auth token |
| 402 | Payment Required | Quota exceeded, seat limit |
| 403 | Forbidden | Permission denied, tenant suspended |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, concurrent modification |
| 410 | Gone | Resource permanently deleted |
| 413 | Payload Too Large | Context window exceeded, file too large |
| 422 | Unprocessable Entity | Guardrail blocked, semantic error |
| 429 | Too Many Requests | Rate limit hit |
| 500 | Internal Server Error | Unhandled exception |
| 502 | Bad Gateway | Upstream returned invalid response |
| 503 | Service Unavailable | Service down, circuit breaker open |
| 504 | Gateway Timeout | Upstream timeout |

## Client-Facing vs Internal Errors

| Aspect | Client-Facing | Internal |
|--------|--------------|----------|
| `message` | Safe, user-friendly | Full technical detail (logged only) |
| Stack trace | Never returned | Logged with trace_id |
| Database details | Never returned | Logged for debugging |
| `details` array | Returned for validation | N/A |

## Error Logging

Every error is logged with structured fields:

```json
{
  "level": "error",
  "trace_id": "trace_abc123",
  "error_code": "AI_AGENT_FAILED",
  "http_status": 500,
  "user_id": "user_xyz",
  "tenant_id": "tenant_acme",
  "endpoint": "/v1/agents/run",
  "method": "POST",
  "message": "Agent execution failed: TypeError in resume_agent.py",
  "stack": "Traceback (most recent call last)...",
  "timestamp": "2026-07-16T10:00:00.000Z"
}
```

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | Never return stack traces to clients | Leaks implementation details; security risk |
| 2 | Always include `trace_id` in errors | Enables support to find the exact request in logs |
| 3 | Use specific error codes, not generic 400/500 | Clients can branch on codes; generic codes are useless |
| 4 | Document every error code at `documentation_url` | Self-service error resolution reduces support tickets |

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Returning 500 for validation errors | Client can't distinguish transient from permanent failures | Return 400 with VALIDATION_* code |
| Different error formats per service | Client must handle N formats | Enforce the envelope via shared middleware |
| Leaking SQL errors in message | Exposes schema and query structure | Map DB errors to generic codes; log details internally |

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Auto-generated error documentation from codes | Medium | Low | Q4 2026 |
| SDK error mapping (per-language exceptions) | Medium | Medium | Q1 2027 |
| Error analytics dashboard (frequency by code) | Medium | Low | Q4 2026 |

## Related Documents

- [`REST-Standards.md`](./REST-Standards.md) — REST conventions
- [`Validation.md`](./Validation.md) — validation rules
- [`API-Reference.md`](./API-Reference.md) — endpoint reference
- [`../AI/Guardrails.md`](../AI/Guardrails.md) — AI guardrails (source of AI_GUARDRAIL_BLOCKED)
