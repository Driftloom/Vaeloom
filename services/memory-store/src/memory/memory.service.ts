import { createHash } from 'node:crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

export interface MemoryRow {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string | null;
  content: string | null;
  content_hash: string;
  size: number;
  metadata: string;
  tags: string[];
  tenant_id: string;
  user_id: string | null;
  workspace_id: string | null;
  source_type: string | null;
  source_uri: string | null;
  source_label: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  async create(dto: CreateMemoryDto): Promise<MemoryRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const userId = this.requestContext.userId;

    const content = dto.content ?? '';
    const contentHash = createHash('sha256').update(content).digest('hex');
    const size = Buffer.byteLength(content, 'utf-8');

    const embedding = await this.computeEmbedding(content);

    const result = await this.db.query<MemoryRow>(
      `INSERT INTO memories (
        type, status, title, summary, content, content_hash, size,
        embedding, metadata, tags, tenant_id, user_id,
        source_type, source_uri, source_label
      ) VALUES ($1, 'INDEXED', $2, $3, $4, $5, $6, $7::vector, $8::jsonb, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        dto.type,
        dto.title,
        dto.summary ?? null,
        dto.content ?? null,
        contentHash,
        size,
        `[${embedding.join(',')}]`,
        JSON.stringify(dto.metadata ?? {}),
        dto.tags ?? [],
        tenantId,
        userId ?? null,
        dto.sourceType ?? null,
        dto.sourceUri ?? null,
        dto.sourceLabel ?? null,
      ],
    );

    this.logger.log({ memoryId: result.rows[0]!.id }, 'Memory created');
    return result.rows[0]!;
  }

  async findAll(queryDto: QueryMemoryDto) {
    const page = queryDto.page ?? 1;
    const pageSize = queryDto.pageSize ?? 20;
    const { types, status, tags, dateFrom, dateTo, search } = queryDto;
    const offset = (page - 1) * pageSize;
    const tenantId = this.requestContext.tenantId ?? 'default';

    const conditions: string[] = ['m.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (types && types.length > 0) {
      conditions.push(`m.type = ANY($${paramIndex}::text[])`);
      params.push(types);
      paramIndex++;
    }

    if (status) {
      conditions.push(`m.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      conditions.push(`m.tags && $${paramIndex}::text[]`);
      params.push(tags);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`m.created_at >= $${paramIndex}::timestamptz`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`m.created_at <= $${paramIndex}::timestamptz`);
      params.push(dateTo);
      paramIndex++;
    }

    if (search) {
      conditions.push(`m.title ILIKE $${paramIndex} OR m.summary ILIKE $${paramIndex} OR m.content ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM memories m WHERE ${whereClause}`,
      params,
    );

    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<MemoryRow>(
      `SELECT m.* FROM memories m WHERE ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
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

  async findById(id: string): Promise<MemoryRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const result = await this.db.query<MemoryRow>(
      `SELECT * FROM memories WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Memory with id "${id}" not found`);
    }

    return result.rows[0]!;
  }

  async update(id: string, dto: UpdateMemoryDto): Promise<MemoryRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const existing = await this.findById(id);

    const type = dto.type ?? existing.type;
    const title = dto.title ?? existing.title;
    const summary = dto.summary !== undefined ? dto.summary : existing.summary;
    const content = dto.content !== undefined ? dto.content : existing.content;
    const sourceType = dto.sourceType !== undefined ? dto.sourceType : existing.source_type;
    const sourceUri = dto.sourceUri !== undefined ? dto.sourceUri : existing.source_uri;
    const sourceLabel = dto.sourceLabel !== undefined ? dto.sourceLabel : existing.source_label;
    const metadata = dto.metadata !== undefined ? dto.metadata : JSON.parse(existing.metadata);
    const tags = dto.tags !== undefined ? dto.tags : existing.tags;

    const body = content ?? '';
    const contentHash = createHash('sha256').update(body).digest('hex');
    const size = Buffer.byteLength(body, 'utf-8');

    const contentChanged = content !== existing.content;
    let embedding: number[] | null = null;

    if (contentChanged && content) {
      embedding = await this.computeEmbedding(content);
    }

    const result = await this.db.query<MemoryRow>(
      `UPDATE memories SET
        type = $1, title = $2, summary = $3, content = $4,
        content_hash = $5, size = $6, metadata = $7::jsonb, tags = $8,
        source_type = $9, source_uri = $10, source_label = $11,
        embedding = COALESCE($12::vector, embedding),
        updated_at = NOW()
      WHERE id = $13 AND tenant_id = $14
      RETURNING *`,
      [
        type,
        title,
        summary,
        content ?? null,
        contentHash,
        size,
        JSON.stringify(metadata),
        tags,
        sourceType,
        sourceUri,
        sourceLabel,
        embedding ? `[${embedding.join(',')}]` : null,
        id,
        tenantId,
      ],
    );

    this.logger.log({ memoryId: id }, 'Memory updated');
    return result.rows[0]!;
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const result = await this.db.query(
      `UPDATE memories SET status = 'DELETED', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException(`Memory with id "${id}" not found`);
    }

    this.logger.log({ memoryId: id }, 'Memory soft-deleted');
  }

  async search(dto: SearchMemoryDto): Promise<{ data: MemoryRow[]; meta: { total: number } }> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const embedding = await this.computeEmbedding(dto.query);
    const embeddingStr = `[${embedding.join(',')}]`;

    const conditions: string[] = ['m.tenant_id = $1', "m.status != 'DELETED'"];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (dto.types && dto.types.length > 0) {
      conditions.push(`m.type = ANY($${paramIndex}::text[])`);
      params.push(dto.types);
      paramIndex++;
    }

    if (dto.tags && dto.tags.length > 0) {
      conditions.push(`m.tags && $${paramIndex}::text[]`);
      params.push(dto.tags);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const limit = dto.limit ?? 10;

    const result = await this.db.query<MemoryRow & { distance: number }>(
      `SELECT m.*, m.embedding <=> $${paramIndex}::vector AS distance
       FROM memories m
       WHERE ${whereClause}
         AND m.embedding IS NOT NULL
       ORDER BY distance ASC
       LIMIT $${paramIndex + 1}`,
      [...params, embeddingStr, limit],
    );

    const minScore = dto.minScore ?? 0;
    const filtered = result.rows.filter((row) => {
      const score = 1 / (1 + row.distance);
      return score >= minScore;
    });

    return {
      data: filtered,
      meta: { total: filtered.length },
    };
  }

  private async computeEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return new Array(1536).fill(0);
    }

    const aiUrl = this.config.get<string>('ai.serviceUrl') as string;
    const endpoint = this.config.get<string>('ai.embeddingEndpoint') as string;

    try {
      const response = await fetch(`${aiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 8192) }),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}: ${await response.text()}`);
      }

      const body = (await response.json()) as { embedding: number[] } | { data: { embedding: number[] }[] };
      const embedding = 'data' in body ? (body.data[0]?.embedding ?? null) : body.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from AI service');
      }

      return embedding;
    } catch (err) {
      this.logger.warn({ err }, 'Embedding computation failed, using zero vector');
      return new Array(1536).fill(0);
    }
  }
}
