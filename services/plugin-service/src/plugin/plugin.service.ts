import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  ExecutionRow,
  PluginRow,
  PluginStatus,
} from './entities/plugin.entity';
import { RegisterPluginDto } from './dto/register-plugin.dto';
import { QueryPluginDto } from './dto/query-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import { ExecutePluginDto } from './dto/execute-plugin.dto';
import { SandboxResult, SandboxService } from './sandbox.service';

@Injectable()
export class PluginService {
  private readonly logger = new Logger(PluginService.name);
  private readonly storeDirectory: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly sandbox: SandboxService,
    private readonly metrics: MetricsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.storeDirectory = this.config.get<string>('plugin.storeDirectory') ?? 'plugins';
  }

  async register(dto: RegisterPluginDto): Promise<PluginRow> {
    const id = randomUUID();
    const tenantId = this.requestContext.tenantId ?? dto.tenantId;

    const result = await this.db.query<PluginRow>(
      `INSERT INTO plugins (
        id, name, version, description, author, license, min_app_version,
        status, permissions, capabilities, hooks, tags, entry_point,
        tenant_id, homepage, repository, icon, config_schema, code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'REGISTERED', $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18)
      RETURNING *`,
      [
        id,
        dto.name,
        dto.version,
        dto.description,
        dto.author,
        dto.license,
        dto.minAppVersion,
        JSON.stringify(dto.permissions ?? {}),
        dto.capabilities,
        dto.hooks,
        dto.tags,
        dto.entryPoint,
        tenantId,
        dto.homepage ?? null,
        dto.repository ?? null,
        undefined,
        dto.configSchema ? JSON.stringify(dto.configSchema) : null,
        dto.code ?? null,
      ],
    );

    this.metrics.activePlugins.inc();
    this.logger.log({ pluginId: id }, 'Plugin registered');
    return result.rows[0]!;
  }

  async findAll(queryDto: QueryPluginDto): Promise<{ data: PluginRow[]; meta: Record<string, unknown> }> {
    const page = queryDto.page ?? 1;
    const pageSize = queryDto.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ['1 = 1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (queryDto.status) {
      conditions.push(`p.status = $${paramIndex}`);
      params.push(queryDto.status);
      paramIndex++;
    }

    if (queryDto.tags && queryDto.tags.length > 0) {
      conditions.push(`p.tags && $${paramIndex}::text[]`);
      params.push(queryDto.tags);
      paramIndex++;
    }

    if (queryDto.search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${queryDto.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM plugins p WHERE ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<PluginRow>(
      `SELECT p.* FROM plugins p WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: dataResult.rows,
      meta: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
    };
  }

  async findById(id: string): Promise<PluginRow> {
    const result = await this.db.query<PluginRow>(
      `SELECT * FROM plugins WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Plugin with id "${id}" not found`);
    }
    return result.rows[0]!;
  }

  async update(id: string, dto: UpdatePluginDto): Promise<PluginRow> {
    const existing = await this.findById(id);

    const version = dto.version ?? existing.version;
    const description = dto.description ?? existing.description;
    const entryPoint = dto.entryPoint ?? existing.entry_point;
    const permissions = dto.permissions
      ? JSON.stringify(dto.permissions)
      : existing.permissions;
    const capabilities = dto.capabilities ?? existing.capabilities;
    const hooks = dto.hooks ?? existing.hooks;
    const tags = dto.tags ?? existing.tags;
    const status = dto.status ?? existing.status;

    const result = await this.db.query<PluginRow>(
      `UPDATE plugins SET
        version = $1, description = $2, entry_point = $3, permissions = $4::jsonb,
        capabilities = $5, hooks = $6, tags = $7, status = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [version, description, entryPoint, permissions, capabilities, hooks, tags, status, id],
    );

    this.logger.log({ pluginId: id, version }, 'Plugin updated');
    return result.rows[0]!;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.db.query(
      `DELETE FROM plugins WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException(`Plugin with id "${id}" not found`);
    }
    this.metrics.activePlugins.dec();
    this.logger.log({ pluginId: id }, 'Plugin unregistered');
    return { message: 'Plugin unregistered successfully' };
  }

  async getPermissions(id: string): Promise<{ permissions: Record<string, unknown> }> {
    const plugin = await this.findById(id);
    return { permissions: JSON.parse(plugin.permissions) };
  }

  async getExecutions(
    id: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: ExecutionRow[]; meta: Record<string, unknown> }> {
    await this.findById(id);
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM plugin_executions WHERE plugin_id = $1`,
      [id],
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<ExecutionRow>(
      `SELECT * FROM plugin_executions WHERE plugin_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [id, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: dataResult.rows,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async execute(id: string, dto: ExecutePluginDto): Promise<ExecutionRow> {
    const plugin = await this.findById(id);

    if (plugin.status === PluginStatus.DISABLED) {
      throw new BadRequestException(`Plugin "${id}" is disabled`);
    }

    const code = dto.code ?? plugin.code ?? (await this.loadCodeFromDisk(plugin.entry_point));
    if (!code) {
      throw new BadRequestException(
        `Plugin "${id}" has no executable code (set code or entryPoint referencing a file in the store)`,
      );
    }

    const timeoutMs = dto.timeoutMs ?? this.config.get<number>('plugin.sandboxTimeoutMs') ?? 5000;

    const result: SandboxResult = await this.sandbox.run(
      code,
      {
        input: dto.input ?? {},
        tenantId: plugin.tenant_id,
        pluginId: plugin.id,
        permissions: JSON.parse(plugin.permissions),
      },
      timeoutMs,
    );

    const execId = randomUUID();
    const insertResult = await this.db.query<ExecutionRow>(
      `INSERT INTO plugin_executions (id, plugin_id, status, duration_ms, output, error_message)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        execId,
        plugin.id,
        result.status,
        result.durationMs,
        JSON.stringify(result.output ?? null),
        result.errorMessage ?? null,
      ],
    );

    this.metrics.sandboxExecutions.inc({ plugin_id: plugin.id, status: result.status });
    if (result.status !== 'success') {
      this.metrics.sandboxFailures.inc({
        plugin_id: plugin.id,
        reason: result.status,
      });
    }

    if (result.status === 'success') {
      await this.db.query(
        `UPDATE plugins SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
        [plugin.id],
      );
    }

    this.logger.log(
      { pluginId: id, status: result.status, durationMs: result.durationMs },
      'Plugin executed',
    );

    return insertResult.rows[0]!;
  }

  private async loadCodeFromDisk(entryPoint: string): Promise<string | null> {
    if (!entryPoint) return null;
    try {
      const filePath = join(process.cwd(), this.storeDirectory, entryPoint);
      return await readFile(filePath, 'utf-8');
    } catch (err) {
      this.logger.warn(
        { entryPoint, err: (err as Error).message },
        'Failed to read plugin code from disk',
      );
      return null;
    }
  }
}
