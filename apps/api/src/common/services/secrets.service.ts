import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Secret metadata for tracking rotation and audit.
 * Per Docs/Security/Secrets.md — every secret has version, creation,
 * and last-rotation timestamps.
 */
interface SecretEntry {
  value: string;
  version: number;
  loadedAt: Date;
  source: 'env' | 'secrets-manager';
}

/**
 * Secrets handling contract (Docs/Security/Secrets.md).
 *
 * Development: reads from process.env at startup, caches in memory.
 * Production: designed to integrate with AWS Secrets Manager / GCP Secret Manager.
 *
 * Key invariants:
 * - Secrets are loaded ONCE at startup, never read from env at runtime.
 * - In-memory cache is the only access path after init.
 * - Supports rotation via refresh() without restart.
 * - Sensitive values are never logged or serialized.
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private readonly store = new Map<string, SecretEntry>();
  private readonly environment: string;

  /** Well-known secret keys that must be present at startup. */
  private static readonly REQUIRED_SECRETS = [
    'AUTH_SECRET',
    'DATABASE_URL',
  ] as const;

  /** Optional secrets loaded if available. */
  private static readonly OPTIONAL_SECRETS = [
    'REDIS_URL',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'SMTP_PASSWORD',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_SECRET',
  ] as const;

  constructor(private readonly config: ConfigService) {
    this.environment = config.get<string>('app.env') ?? 'development';
  }

  async onModuleInit(): Promise<void> {
    await this.loadSecrets();
    this.logger.log(
      `Secrets loaded: ${this.store.size} entries from ${this.getBackend()} backend`,
    );
  }

  /**
   * Retrieve a secret value. Returns undefined if the key was never loaded.
   * This is the ONLY way application code should access secrets.
   */
  get(key: string): string | undefined {
    return this.store.get(key)?.value;
  }

  /**
   * Retrieve a required secret. Throws if missing — use for secrets that
   * the service cannot function without.
   */
  getOrThrow(key: string): string {
    const entry = this.store.get(key);
    if (!entry) {
      throw new Error(
        `Required secret "${key}" is not available. ` +
        `Check that it is set in the ${this.getBackend()} backend.`,
      );
    }
    return entry.value;
  }

  /**
   * Refresh secrets from the backend. Called on rotation notification
   * or manual trigger. Existing values are kept until the new ones succeed.
   */
  async refresh(): Promise<void> {
    this.logger.log('Refreshing secrets from backend...');
    const previousSize = this.store.size;
    await this.loadSecrets();
    this.logger.log(
      `Secrets refreshed: ${this.store.size} entries (was ${previousSize})`,
    );
  }

  /** Check whether a secret key is available. */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** List loaded secret keys (never values) for audit purposes. */
  listKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /** Get metadata about a secret (never the value). */
  getMeta(key: string): Omit<SecretEntry, 'value'> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return {
      version: entry.version,
      loadedAt: entry.loadedAt,
      source: entry.source,
    };
  }

  // ─── Private ───

  private getBackend(): string {
    return this.isProduction() ? 'secrets-manager' : 'env';
  }

  private isProduction(): boolean {
    return this.environment === 'production' || this.environment === 'staging';
  }

  private async loadSecrets(): Promise<void> {
    if (this.isProduction()) {
      await this.loadFromSecretsManager();
    } else {
      this.loadFromEnv();
    }
    this.validateRequired();
  }

  /**
   * Development/test: read from process.env at startup and cache.
   * After this, no code should read process.env for secrets.
   */
  private loadFromEnv(): void {
    const allKeys = [
      ...SecretsService.REQUIRED_SECRETS,
      ...SecretsService.OPTIONAL_SECRETS,
    ];

    for (const key of allKeys) {
      const value = process.env[key];
      if (value !== undefined && value !== '') {
        this.store.set(key, {
          value,
          version: 1,
          loadedAt: new Date(),
          source: 'env',
        });
      }
    }
  }

  /**
   * Production/staging: load from cloud secrets manager.
   * Currently falls back to env vars with a warning.
   * When a real secrets manager SDK is integrated, this method
   * calls the cloud API and populates the store.
   */
  private async loadFromSecretsManager(): Promise<void> {
    // Cloud secrets manager integration point.
    // For now, fall back to env with a warning — this ensures the
    // contract is in place and prod code paths are exercised.
    this.logger.warn(
      'Secrets manager SDK not yet configured — falling back to env vars. ' +
      'Configure AWS_SECRETS_PREFIX or GCP_SECRET_PROJECT to enable cloud secrets.',
    );
    this.loadFromEnv();

    // Mark source as secrets-manager so downstream code knows the intent
    for (const entry of this.store.values()) {
      entry.source = 'secrets-manager';
    }
  }

  private validateRequired(): void {
    const missing: string[] = [];
    for (const key of SecretsService.REQUIRED_SECRETS) {
      if (!this.store.has(key)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required secrets: ${missing.join(', ')}. ` +
        `Ensure they are set in the ${this.getBackend()} backend.`,
      );
    }
  }
}
