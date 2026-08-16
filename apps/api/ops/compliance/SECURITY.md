# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of Vaeloom seriously. If you believe you have found a
security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please send a description of the issue to **security@vaeloom.com**
(preferred) or use the GitHub Security Advisory
["Report a Vulnerability"](https://github.com/vaeloom/vaeloom/security/advisories/new)
tab.

You should receive a response within 48 hours. If you do not, please follow up
via email to ensure we received your original message.

### What to include

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Disclosure Timeline

- **48h**: Initial acknowledgement
- **7 days**: Status update with ETA for fix
- **30 days**: Target for releasing a patched version
- **90 days**: Maximum disclosure window for critical issues

## Security Features

### Authentication & Authorization

- JWT-based authentication with RS256 signing
- Role-based access control (RBAC) with fine-grained permissions
- SSO via Google/Microsoft OIDC
- Session management with refresh token rotation

### API Security

- Rate limiting (sliding window, per-endpoint configurable)
- CORS with restricted origins
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- API key authentication with bcrypt-hashed keys
- IP allowlisting with CIDR support

### Data Security

- Encryption at rest via AES-256
- Encryption in transit via TLS 1.3
- Secrets management via Infisical with local fallback
- Data retention policies with automated deletion/archival
- PII anonymization for GDPR compliance

### Observability

- Structured audit logging with correlation IDs
- OpenTelemetry tracing
- Prometheus metrics
- All secrets redacted from logs

## Security Checklist

- [ ] JWT secret changed from default
- [ ] Encryption key set and >= 32 characters
- [ ] Database URL configured for production
- [ ] Allowed origins restricted to known domains
- [ ] Rate limits configured for production traffic
- [ ] CORS methods/headers restricted
- [ ] IP allowlist configured (if applicable)
- [ ] Retention policies configured
- [ ] Audit logging enabled
- [ ] Secrets stored in Infisical (not config files)
