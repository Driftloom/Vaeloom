# GDPR Compliance Documentation

## Data Controller
Vaeloom Inc.
Contact: dpo@vaeloom.com

## Data Processor
Vaeloom Backend (self-hosted or SaaS)

## Personal Data Collected

| Category | Data Points | Purpose | Retention |
|----------|------------|---------|-----------|
| Identity | Name, email address | Account creation, communication | Until account deletion |
| Authentication | Password hash, SSO tokens | Authentication | Until account deletion |
| Usage | Agent executions, memories, documents | Service provision | Configured via retention policies |
| Technical | IP address, user agent, device info | Security, audit logging | 90 days |
| Communications | Notifications, preferences | Service communication | Until account deletion |

## Lawful Basis for Processing

- **Consent**: User registration, marketing communications
- **Contractual necessity**: Service delivery, billing
- **Legal obligation**: Audit logging, fraud prevention
- **Legitimate interests**: Security monitoring, service improvement

## Data Subject Rights

### Right to Access (Art. 15)
Users can export all their data via `GET /api/v1/gdpr/export` (admin role required).

### Right to Rectification (Art. 16)
Users can update their profile information via the account settings interface.

### Right to Erasure (Art. 17)
Users can request deletion via `POST /api/v1/gdpr/delete` (admin role required).
The system:
1. Anonymizes the user record (email, name, avatar replaced)
2. Deletes all associated data (sessions, workspaces, agents, etc.)
3. Retains anonymized audit trail for legal compliance

### Right to Restrict Processing (Art. 18)
Account suspension available via support request.

### Right to Data Portability (Art. 20)
Data export in JSON format via the GDPR export endpoint.

### Right to Object (Art. 21)
Users can opt out of non-essential processing via notification preferences.

## Data Breach Notification

Internal procedures ensure notification to supervisory authority within 72 hours
and to affected data subjects without undue delay when risk is high.

## Data Protection Impact Assessment (DPIA)

A DPIA has been completed covering:
- User data collection and processing
- Third-party integrations
- Automated decision-making by agents

## International Transfers

Data is stored in EU data centers (GDPR-compliant). Standard Contractual Clauses
(SCCs) are in place for any data transferred outside the EEA.

## Third-Party Processors

- **Infisical** — Secrets management
- **Anthropic/OpenAI** — LLM processing (no training on API data)
- **Stripe** — Payment processing
