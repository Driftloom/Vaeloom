# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

Only the latest minor release of the current major version receives security patches.
Older versions are not supported and users are strongly advised to upgrade.

## Reporting a Vulnerability

We take the security of Vaeloom seriously. If you believe you have found a
security vulnerability, please report it to us as described below.

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please send an email to **[security@vaeloom.dev](mailto:security@vaeloom.dev)**.

You should receive an acknowledgement within **48 hours**. If for some reason
you do not, please follow up via email to ensure we received your message.

When reporting, please include:

- Type of issue (e.g. XSS, SQL injection, RCE, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### PGP Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

[PGP key for security@vaeloom.dev — available via keys.openpgp.org]
-----END PGP PUBLIC KEY BLOCK-----
```

You may encrypt sensitive information using the PGP key above.

## Security Practices

### Dependency Scanning

All dependencies are scanned automatically via GitHub Dependabot and Snyk on
every commit. Pull requests introducing vulnerable dependencies are blocked
from merging.

### Static Application Security Testing (SAST)

Every pull request is analysed with:

- **CodeQL** — semantic code analysis for JavaScript, TypeScript, and Python
- **Semgrep** — custom and OSS rule sets for common vulnerability patterns
- **Trivy** — filesystem and IaC scanning for misconfigurations

### Penetration Testing

A full third-party penetration test is conducted **quarterly** on the latest
release. Internal penetration tests are performed after every major feature
release. Results are triaged and remediated before the next release.

### Secrets Scanning

Pre-commit hooks and CI pipelines run `git secrets` and `truffleHog` to detect
accidental commits of credentials, API keys, or tokens.

## Bug Bounty Program

Vaeloom operates a **paid bug bounty program** for verified vulnerabilities.

### Scope

- The Vaeloom platform (API Gateway, microservices, web app)
- SDKs and client libraries
- Infrastructure configuration (Kubernetes, Terraform, CI/CD)

### Out of Scope

- Issues in third-party dependencies that are already reported upstream
- Denial of Service attacks
- Social engineering of Vaeloom employees or contractors
- Physical security attacks
- Self-XSS, UI redressing, or issues requiring man-in-the-middle

### Rewards

| Severity | Reward        |
| -------- | ------------- |
| Critical | $5,000–$10,000 |
| High     | $2,000–$5,000  |
| Medium   | $500–$2,000    |
| Low      | $100–$500      |

Rewards are paid in USD via bank transfer or cryptocurrency. Duplicate reports
are not rewarded. All decisions regarding severity and reward amount are at the
sole discretion of the Vaeloom security team.

## Disclosure Policy

- Reporters are expected to allow a **90-day** disclosure window from the date
  a fix is released before making any information public.
- Vaeloom will release a security advisory on GitHub and may assign a CVE for
  confirmed vulnerabilities.
- Reporters will be credited in the advisory unless they request anonymity.
- Coordinated disclosure is strongly preferred. We will work with you to
  establish a mutually agreeable disclosure timeline.
