import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { ConnectorType, CreateConnectorDto } from './dto/create-connector.dto';
import { QueryConnectorDto } from './dto/query-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';

export interface ConnectorRow {
  id: string;
  name: string;
  type: string;
  status: string;
  config: string;
  tenant_id: string;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SyncStatus {
  connectorId: string;
  status: string;
  error: string | null;
  syncedAt: Date | null;
}

@Injectable()
export class ConnectorService {
  private readonly logger = new Logger(ConnectorService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
  ) {}

  async create(dto: CreateConnectorDto): Promise<ConnectorRow> {
    const tenantId = dto.tenantId ?? this.requestContext.tenantId ?? 'default';

    this.validateConfig(dto.type, dto.config);

    const result = await this.db.query<ConnectorRow>(
      `INSERT INTO connectors (name, type, status, config, tenant_id)
       VALUES ($1, $2, 'ACTIVE', $3::jsonb, $4)
       RETURNING *`,
      [dto.name, dto.type, JSON.stringify(dto.config), tenantId],
    );

    this.metrics.recordEvent('connector.created');
    this.logger.log({ connectorId: result.rows[0]!.id }, 'Connector created');
    return result.rows[0]!;
  }

  async findAll(query: QueryConnectorDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const tenantId = this.requestContext.tenantId ?? 'default';

    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (query.type) {
      conditions.push(`type = $${idx}`);
      params.push(query.type);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM connectors WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<ConnectorRow>(
      `SELECT * FROM connectors WHERE ${where}
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

  async findById(id: string): Promise<ConnectorRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const result = await this.db.query<ConnectorRow>(
      `SELECT * FROM connectors WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Connector with id "${id}" not found`);
    }

    return result.rows[0]!;
  }

  async update(id: string, dto: UpdateConnectorDto): Promise<ConnectorRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const existing = await this.findById(id);

    const name = dto.name ?? existing.name;
    const config = dto.config !== undefined ? dto.config : JSON.parse(existing.config);

    if (dto.config !== undefined) {
      this.validateConfig(existing.type as ConnectorType, dto.config);
    }

    const result = await this.db.query<ConnectorRow>(
      `UPDATE connectors SET name = $1, config = $2::jsonb, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [name, JSON.stringify(config), id, tenantId],
    );

    this.logger.log({ connectorId: id }, 'Connector updated');
    return result.rows[0]!;
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const result = await this.db.query(
      `DELETE FROM connectors WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Connector with id "${id}" not found`);
    }

    this.metrics.recordEvent('connector.deleted');
    this.logger.log({ connectorId: id }, 'Connector deleted');
  }

  async triggerSync(id: string): Promise<SyncStatus> {
    const connector = await this.findById(id);
    const tenantId = this.requestContext.tenantId ?? 'default';

    let status = 'SUCCESS';
    let error: string | null = null;

    try {
      const integrationUrl = this.config.get<string>('integration.serviceUrl') as string;
      const config = JSON.parse(connector.config) as Record<string, unknown>;

      await firstValueFrom(
        this.http.post(`${integrationUrl}/api/v1/integrations/sync`, {
          connectorId: connector.id,
          type: connector.type,
          config,
          tenantId,
        }),
      );
    } catch (err) {
      status = 'FAILED';
      error = err instanceof Error ? err.message : 'Sync failed';
      this.logger.warn({ connectorId: id, err }, 'Connector sync failed');
    }

    const result = await this.db.query<ConnectorRow>(
      `UPDATE connectors SET last_sync_status = $1, last_sync_error = $2, last_sync_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [status, error, id, tenantId],
    );

    this.metrics.recordEvent(`connector.sync.${status.toLowerCase()}`);

    const row = result.rows[0]!;
    return {
      connectorId: row.id,
      status: row.last_sync_status ?? status,
      error: row.last_sync_error,
      syncedAt: row.last_sync_at,
    };
  }

  async getSyncStatus(id: string): Promise<SyncStatus> {
    const connector = await this.findById(id);
    return {
      connectorId: connector.id,
      status: connector.last_sync_status ?? 'NEVER_SYNCED',
      error: connector.last_sync_error,
      syncedAt: connector.last_sync_at,
    };
  }

  async testConnection(id: string): Promise<{ ok: boolean; message: string }> {
    const connector = await this.findById(id);
    const config = JSON.parse(connector.config) as Record<string, unknown>;

    try {
      this.validateConfig(connector.type as ConnectorType, config);
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Invalid config' };
    }

    if (connector.type === ConnectorType.REST || connector.type === ConnectorType.GRAPHQL) {
      const url = config.url as string | undefined;
      if (!url) {
        return { ok: false, message: 'Missing url in config' };
      }
      try {
        await firstValueFrom(this.http.get(url, { timeout: 5000 }));
        return { ok: true, message: 'Connection successful' };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Connection failed' };
      }
    }

    return { ok: true, message: 'Configuration valid' };
  }

  private validateConfig(type: ConnectorType, config: Record<string, unknown>): void {
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('config must be an object');
    }

    switch (type) {
      case ConnectorType.REST:
      case ConnectorType.GRAPHQL:
        if (typeof config.url !== 'string' || config.url.length === 0) {
          throw new BadRequestException(`${type} connector requires a "url" in config`);
        }
        break;
      case ConnectorType.DATABASE:
        if (typeof config.connectionString !== 'string' || config.connectionString.length === 0) {
          throw new BadRequestException('database connector requires a "connectionString" in config');
        }
        break;
      case ConnectorType.FILE:
        if (typeof config.path !== 'string' || config.path.length === 0) {
          throw new BadRequestException('file connector requires a "path" in config');
        }
        break;
      default:
        throw new BadRequestException(`Unsupported connector type: ${type}`);
    }
  }
}
