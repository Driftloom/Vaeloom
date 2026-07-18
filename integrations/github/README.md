# @vaeloom/integration-github

GitHub integration for Vaeloom. Lists repositories, reads/writes issues and
pull requests, fetches commits, registers webhooks, and syncs activity into
Vaeloom memories.

## Install

```bash
pnpm add @vaeloom/integration-github
```

## Setup

- **Personal Access Token**: create a PAT with `repo` and `read:org` scopes.
- **OAuth App**: set `clientId`, `clientSecret`, `redirectUri`, and `webhookSecret`.

## Usage

```ts
import { GithubIntegration, parseGithubConfig } from '@vaeloom/integration-github';

const github = new GithubIntegration({ masterKey: process.env.VAELOOM_MASTER_KEY! });

const config = parseGithubConfig({ accessToken: process.env.GITHUB_TOKEN! });
const connection = await github.connect({ provider: 'github', settings: config });

const repos = await github.listRepos(connection.connectionId);
const issues = await github.getIssues(connection.connectionId, 'octocat/hello', 'open');
await github.createIssue(connection.connectionId, 'octocat/hello', 'New bug', 'Details');
const prs = await github.getPullRequests(connection.connectionId, 'octocat/hello');
const commits = await github.getCommits(connection.connectionId, 'octocat/hello', '2024-01-01T00:00:00Z');

// Register a webhook
await github.createWebhook(connection.connectionId, 'octocat/hello', 'https://app.vaeloom.com/webhooks/github');

// OAuth flow
const authClient = github.buildAuthClient({ provider: 'github', settings: config });
const url = authClient.getAuthorizeUrl('state-1');
const token = await authClient.exchangeCodeForToken(code);

// Verify webhook
await github.handleWebhook({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
  signature: req.headers['x-hub-signature-256'],
  rawBody: rawBodyString,
});

// Sync
const result = await github.sync(connection.connectionId);
```

## Security

Tokens are encrypted at rest with AES-256-GCM. Webhook signatures use
HMAC-SHA256 (`X-Hub-Signature-256`) verified with a constant-time comparison.
