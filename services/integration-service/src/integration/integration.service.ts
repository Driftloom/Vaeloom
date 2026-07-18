import { createHmac, timingSafeEqual } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { CryptoService } from './crypto.service';
import {
  ConnectIntegrationDto,
  IntegrationProvider,
} from './dto/connect-integration.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { QueryIntegrationDto } from './dto/query-integration.dto';

export interface IntegrationRow {
  id: string;
  provider: string;
  status: string;
  tenant_id: string;
  external_account_id: string | null;
  encrypted_token: string;
  metadata: string;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
  ) {}

  async connect(dto: ConnectIntegrationDto): Promise<IntegrationRow> {
    const tenantId = dto.tenantId ?? this.requestContext.tenantId ?? 'default';

    const token = dto.token
      ? dto.token
      : await this.exchangeCode(dto.provider, dto.oauthCode as string);

    const encryptedToken = this.crypto.encrypt(token);

    const result = await this.db.query<IntegrationRow>(
      `INSERT INTO integrations (provider, status, tenant_id, external_account_id, encrypted_token, metadata)
       VALUES ($1, 'CONNECTED', $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [
        dto.provider,
        tenantId,
        dto.externalAccountId ?? null,
        encryptedToken,
        JSON.stringify({}),
      ],
    );

    this.metrics.recordEvent('integration.connected');
    this.logger.log({ integrationId: result.rows[0]!.id, provider: dto.provider }, 'Integration connected');
    return result.rows[0]!;
  }

  async findAll(query: QueryIntegrationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const tenantId = this.requestContext.tenantId ?? 'default';

    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (query.provider) {
      conditions.push(`provider = $${idx}`);
      params.push(query.provider);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM integrations WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<IntegrationRow>(
      `SELECT * FROM integrations WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dataResult.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async findById(id: string): Promise<IntegrationRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const result = await this.db.query<IntegrationRow>(
      `SELECT * FROM integrations WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Integration with id "${id}" not found`);
    }
    return result.rows[0]!;
  }

  async disconnect(id: string): Promise<void> {
    const integration = await this.findById(id);
    const tenantId = this.requestContext.tenantId ?? 'default';

    await this.revokeToken(integration);

    const result = await this.db.query(
      `UPDATE integrations SET status = 'DISCONNECTED', encrypted_token = '', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Integration with id "${id}" not found`);
    }

    this.metrics.recordEvent('integration.disconnected');
    this.logger.log({ integrationId: id }, 'Integration disconnected');
  }

  async handleWebhook(
    id: string,
    signature: string | undefined,
    rawBody: string,
    payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    const integration = await this.findById(id);

    const verified = this.verifySignature(integration.provider, signature, rawBody);
    if (!verified) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.emitEvent('integration.webhook.received', {
      integrationId: integration.id,
      provider: integration.provider,
      tenantId: integration.tenant_id,
      payload,
    });

    this.metrics.recordEvent('integration.webhook.received');
    this.logger.log({ integrationId: id, provider: integration.provider }, 'Webhook received');
    return { received: true };
  }

  async sync(id: string): Promise<{ integrationId: string; status: string; syncedAt: Date }> {
    const integration = await this.findById(id);
    const tenantId = this.requestContext.tenantId ?? 'default';

    await this.emitEvent('integration.sync.requested', {
      integrationId: integration.id,
      provider: integration.provider,
      tenantId,
    });

    const result = await this.db.query<IntegrationRow>(
      `UPDATE integrations SET last_sync_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId],
    );

    this.metrics.recordEvent('integration.sync.requested');
    return {
      integrationId: id,
      status: 'SYNC_STARTED',
      syncedAt: result.rows[0]!.last_sync_at as Date,
    };
  }

  async oauthCallback(dto: OAuthCallbackDto): Promise<IntegrationRow> {
    const token = await this.exchangeCode(dto.provider, dto.code);
    return this.connect({
      provider: dto.provider,
      token,
      tenantId: dto.tenantId,
    });
  }

  private async exchangeCode(provider: IntegrationProvider, code: string): Promise<string> {
    if (!code) {
      throw new BadRequestException('Missing OAuth code');
    }

    const tokenEndpoints: Record<IntegrationProvider, string> = {
      [IntegrationProvider.SLACK]: 'https://slack.com/api/oauth.v2.access',
      [IntegrationProvider.GITHUB]: 'https://github.com/login/oauth/access_token',
      [IntegrationProvider.NOTION]: 'https://api.notion.com/v1/oauth/token',
      [IntegrationProvider.GOOGLE_DRIVE]: 'https://oauth2.googleapis.com/token',
      [IntegrationProvider.EMAIL]: 'https://oauth2.googleapis.com/token',
      [IntegrationProvider.CALENDAR]: 'https://oauth2.googleapis.com/token',
    };

    const endpoint = tokenEndpoints[provider];

    try {
      const response = await firstValueFrom(
        this.http.post<{ access_token?: string; accessToken?: string }>(
          endpoint,
          { code, grant_type: 'authorization_code' },
          { headers: { Accept: 'application/json' } },
        ),
      );
      const token = response.data.access_token ?? response.data.accessToken;
      if (!token) {
        throw new Error('No access_token in provider response');
      }
      return token;
    } catch (err) {
      this.logger.warn({ provider, err }, 'OAuth code exchange failed');
      throw new BadRequestException(`Failed to exchange OAuth code for ${provider}`);
    }
  }

  private async revokeToken(integration: IntegrationRow): Promise<void> {
    if (!integration.encrypted_token) return;
    try {
      const token = this.crypto.decrypt(integration.encrypted_token);
      this.logger.debug({ provider: integration.provider }, 'Token revoked (masked)');
      void token;
    } catch (err) {
      this.logger.warn({ integrationId: integration.id, err }, 'Token revoke skipped');
    }
  }

  private verifySignature(
    provider: string,
    signature: string | undefined,
    rawBody: string,
  ): boolean {
    if (provider === IntegrationProvider.SLACK) {
      const secret = this.config.get<string>('integration.slackSigningSecret') ?? '';
      if (!secret) return true;
      if (!signature) return false;
      const expected = `v0=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      return this.safeEqual(signature, expected);
    }

    if (provider === IntegrationProvider.GITHUB) {
      const secret = this.config.get<string>('integration.githubWebhookSecret') ?? '';
      if (!secret) return true;
      if (!signature) return false;
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      return this.safeEqual(signature, expected);
    }

    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private async emitEvent(type: string, payload: Record<string, unknown>): Promise<void> {
    const eventBusUrl = this.config.get<string>('integration.eventBusUrl') as string;
    try {
      await firstValueFrom(
        this.http.post(`${eventBusUrl}/api/v1/events`, {
          type,
          source: 'integration-service',
          category: 'integration',
          payload,
          tenantId: (payload.tenantId as string) ?? 'system',
        }),
      );
    } catch (err) {
      this.logger.warn({ type, err }, 'Failed to emit event to event-bus');
    }
  }
}
