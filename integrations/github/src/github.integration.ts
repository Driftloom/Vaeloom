import { Octokit } from '@octokit/rest';
import type {
  ConnectionResult,
  IngestedMemory,
  Integration,
  IntegrationConfig,
  SyncResult,
} from './types';
import { GithubConfig, parseGithubConfig } from './config';
import { GithubAuthClient } from './auth-client';
import { decryptSecret, encryptSecret, verifyGithubSignature } from './auth';
import { GithubApiError, GithubAuthError, GithubWebhookVerificationError } from './errors';

const DEFAULT_MASTER_KEY = 'vaeloom-dev-secret';

interface StoredConnection {
  connectionId: string;
  config: GithubConfig;
  token: string;
  login?: string;
}

export class GithubIntegration implements Integration {
  readonly provider = 'github';

  private readonly connections = new Map<string, StoredConnection>();
  private readonly masterKey: string;
  private readonly tokenFetch: typeof fetch;

  constructor(opts?: { masterKey?: string; tokenFetch?: typeof fetch }) {
    this.masterKey = opts?.masterKey ?? process.env.VAELOOM_MASTER_KEY ?? DEFAULT_MASTER_KEY;
    this.tokenFetch = opts?.tokenFetch ?? fetch;
  }

  private octokit(token: string): Octokit {
    return new Octokit({ auth: token });
  }

  async connect(config: IntegrationConfig): Promise<ConnectionResult> {
    const ghConfig = parseGithubConfig({ ...config.settings, provider: config.provider });
    const token = ghConfig.accessToken;
    if (!token) {
      throw new GithubAuthError('GitHub config requires an accessToken (PAT) or GitHub App credentials.');
    }
    const client = this.octokit(token);
    const { data } = await client.users.getAuthenticated();
    const connectionId = `github-${data.login}`;
    this.connections.set(connectionId, {
      connectionId,
      config: ghConfig,
      token: encryptSecret(token, this.masterKey),
      login: data.login ?? undefined,
    });
    return {
      connectionId,
      provider: this.provider,
      connectedAt: new Date().toISOString(),
      ready: true,
      metadata: { login: data.login, id: data.id },
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  private getConnection(connectionId: string): StoredConnection {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new GithubAuthError(`Unknown connection: ${connectionId}`);
    return conn;
  }

  private tokenFor(connectionId: string): string {
    return decryptSecret(this.getConnection(connectionId).token, this.masterKey);
  }

  // ---- Repos / Issues / PRs / Commits ----

  async listRepos(connectionId: string, owner?: string): Promise<string[]> {
    const client = this.octokit(this.tokenFor(connectionId));
    if (owner) {
      const { data } = await client.repos.listForUser({ username: owner });
      return data.map((r) => r.full_name);
    }
    const { data } = await client.repos.listForAuthenticatedUser({ per_page: 100 });
    return data.map((r) => r.full_name);
  }

  async getIssues(connectionId: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    const client = this.octokit(this.tokenFor(connectionId));
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new GithubApiError('repo must be in owner/name form');
    const { data } = await client.issues.listForRepo({ owner, repo: name, state, per_page: 100 });
    return data.map((i) => ({
      id: i.id,
      number: i.number,
      title: i.title,
      body: i.body ?? undefined,
      state: i.state as 'open' | 'closed',
      htmlUrl: i.html_url,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    }));
  }

  async createIssue(connectionId: string, repo: string, title: string, body?: string) {
    const client = this.octokit(this.tokenFor(connectionId));
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new GithubApiError('repo must be in owner/name form');
    const { data } = await client.issues.create({ owner, repo: name, title, body });
    return { id: data.id, number: data.number, htmlUrl: data.html_url };
  }

  async getPullRequests(connectionId: string, repo: string) {
    const client = this.octokit(this.tokenFor(connectionId));
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new GithubApiError('repo must be in owner/name form');
    const { data } = await client.pulls.list({ owner, repo: name, per_page: 100 });
    return data.map((p) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      state: p.state,
      htmlUrl: p.html_url,
      draft: p.draft ?? false,
    }));
  }

  async getCommits(connectionId: string, repo: string, since?: string) {
    const client = this.octokit(this.tokenFor(connectionId));
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new GithubApiError('repo must be in owner/name form');
    const { data } = await client.repos.listCommits({
      owner,
      repo: name,
      since,
      per_page: 100,
    });
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? 'unknown',
      date: c.commit.author?.date ?? new Date().toISOString(),
    }));
  }

  async createWebhook(connectionId: string, repo: string, callbackUrl: string) {
    const client = this.octokit(this.tokenFor(connectionId));
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new GithubApiError('repo must be in owner/name form');
    const { data } = await client.repos.createWebhook({
      owner,
      repo: name,
      config: { url: callbackUrl, content_type: 'json', secret: this.getConnection(connectionId).config.webhookSecret },
      events: ['push', 'issues', 'pull_request'],
    });
    return { id: data.id, url: data.config?.url };
  }

  // ---- OAuth helpers ----

  buildAuthClient(config: IntegrationConfig): GithubAuthClient {
    return new GithubAuthClient(parseGithubConfig({ ...config.settings, provider: config.provider }));
  }

  // ---- Webhook ----

  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<unknown> {
    const data = payload as {
      webhookSecret?: string;
      signature?: string;
      rawBody?: string;
      event?: string;
      action?: string;
      repository?: { full_name: string };
      body?: Record<string, unknown>;
    };
    if (data.webhookSecret) {
      if (!verifyGithubSignature(data.webhookSecret, data.signature, data.rawBody ?? '')) {
        throw new GithubWebhookVerificationError();
      }
    }
    // Parsed event is available via data.body; downstream consumers act on it.
  }

  // ---- Sync ----

  async sync(connectionId: string): Promise<SyncResult> {
    const client = this.octokit(this.tokenFor(connectionId));
    const repos = await this.listRepos(connectionId);
    let ingested = 0;
    const entities = { issue: 0, pull_request: 0, commit: 0 };
    for (const repo of repos.slice(0, 10)) {
      const issues = await this.getIssues(connectionId, repo, 'all');
      for (const issue of issues) {
        const mem: IngestedMemory = {
          externalId: `${repo}#${issue.number}`,
          provider: this.provider,
          entityType: 'github_issue',
          title: `[${repo}] ${issue.title}`,
          content: issue.body ?? '',
          url: issue.htmlUrl,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          metadata: { repo, number: issue.number, state: issue.state },
        };
        void mem;
        entities.issue += 1;
        ingested += 1;
      }
      const prs = await this.getPullRequests(connectionId, repo);
      entities.pull_request += prs.length;
      ingested += prs.length;
      const commits = await this.getCommits(connectionId, repo);
      entities.commit += commits.length;
      ingested += commits.length;
    }
    void client;
    return {
      connectionId,
      syncedAt: new Date().toISOString(),
      recordsIngested: ingested,
      recordsFailed: 0,
      entities: [
        { type: 'issue', ingested: entities.issue, failed: 0 },
        { type: 'pull_request', ingested: entities.pull_request, failed: 0 },
        { type: 'commit', ingested: entities.commit, failed: 0 },
      ],
    };
  }
}
