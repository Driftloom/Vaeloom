# Maintainers

This file lists the current maintainers of the Vaeloom project, their areas of
responsibility, and contact information.

## Project Maintainers

| Name           | Email                         | GitHub                                        | Area                           |
| -------------- | ----------------------------- | --------------------------------------------- | ------------------------------ |
| Alex Chen      | alex@vaeloom.dev              | [@alexchen](https://github.com/alexchen)      | Platform Core, API Gateway     |
| Maya Rodriguez | maya@vaeloom.dev              | [@mayarodriguez](https://github.com/mayarodriguez) | AI/ML, Knowledge Graph, Memory Store |
| Kunal Sharma   | kunal@vaeloom.dev             | [@kunalsharma](https://github.com/kunalsharma) | Infrastructure, CI/CD, K8s     |
| Emma Larsson   | emma@vaeloom.dev              | [@emmalarsson](https://github.com/emmalarsson) | Frontend, UI Kit, Web App      |
| Sam Okafor     | sam@vaeloom.dev               | [@samokafor](https://github.com/samokafor)     | Documentation, Developer Experience |

## Emeritus Maintainers

No emeritus maintainers at this time.

## Governance

### Decision Making

Vaeloom uses a **Lazy Consensus** model for project decisions:

- Proposed changes (features, architectural decisions, policy changes) are
  communicated via GitHub issues or discussions.
- A minimum **72-hour** comment period is provided for all proposals.
- If no objections are raised within the comment period, the proposal is
  considered accepted and may proceed.
- Objections must be accompanied by a clear rationale and, where possible, a
  proposed alternative.

### Maintainer Responsibilities

- Review and merge pull requests in their area of responsibility
- Triage and respond to issues within 3 business days
- Participate in release planning and execution
- Mentor new contributors
- Enforce the Code of Conduct

### Adding and Removing Maintainers

New maintainers may be added by:

1. A nomination from an existing maintainer
2. A second from another maintainer
3. A 7-day Lazy Consensus period with no objections
4. A majority vote if objections are raised

Maintainers may step down voluntarily at any time. A maintainer may be removed
by unanimous vote of the remaining maintainers due to sustained inactivity
(no contributions for 6+ months) or a Code of Conduct violation.

## Release Process

### Versioning

Vaeloom follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** — breaking changes to public APIs or data formats
- **MINOR** — new features, backward-compatible
- **PATCH** — bug fixes and security patches

### Release Cadence

- **Patch releases** — as needed (typically weekly)
- **Minor releases** — every 4–6 weeks
- **Major releases** — every 6–12 months, with at least 4 weeks of release
  candidate phase

### Release Approval

A release requires:

1. All tests passing on the `main` branch
2. Updated `CHANGELOG.md` with the new version entry
3. Updated version numbers in `package.json` and relevant `service.yaml` files
4. Sign-off from at least **two maintainers** whose areas cover the changes
5. A signed Git tag for the release commit
6. Release notes published on GitHub with a summary of changes

### Release Steps

1. Create a release branch: `release/v<major>.<minor>.<patch>`
2. Finalize the changelog and bump version numbers
3. Open a pull request from the release branch to `main`
4. After approval, tag the merge commit: `git tag -s v<major>.<minor>.<patch>`
5. GitHub Actions builds and publishes Docker images, npm packages, and PyPI packages
6. Publish the GitHub Release with changelog notes
7. Announce the release on the community discussion board
