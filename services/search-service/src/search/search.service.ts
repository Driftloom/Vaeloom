import { randomUUID } from 'node:crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  IndexDto,
  SearchFeedbackDto,
  SearchQueryDto,
  SuggestQueryDto,
} from './dto/search.dto';

export interface SearchRow {
  id: string;
  source_type: 'memory' | 'knowledge';
  title: string;
  snippet: string | null;
  score: number;
  tenant_id: string;
  tags: string[];
  created_at: Date;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly embeddingTimeoutMs = 20000;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly http: HttpService,
  ) {}

  async unifiedSearch(dto: SearchQueryDto): Promise<{ data: SearchRow[]; meta: Record<string, unknown> }> {
    const embedding = await this.computeEmbedding(dto.query);
    const embeddingStr = `[${embedding.join(',')}]`;
    const limit = dto.limit ?? 10;

    const scope = dto.scope ?? 'all';
    const minScore = dto.minScore ?? 0;

    const tenantConditions: string[] = [];
    const tenantParams: unknown[] = [];
    let tenantIdx = 1;
    const tenantIds = dto.tenantIds;
    if (tenantIds && tenantIds.length > 0) {
      tenantConditions.push(`tenant_id = ANY($${tenantIdx}::text[])`);
      tenantParams.push(tenantIds);
      tenantIdx++;
    }

    const queries: string[] = [];
    const unionParams: unknown[] = [];
    let paramIndex = tenantParams.length + 1;

    if (scope === 'all' || scope === 'memory') {
      const where = tenantConditions.length > 0 ? `WHERE ${tenantConditions.join(' AND ')} AND embedding IS NOT NULL` : 'WHERE embedding IS NOT NULL';
      queries.push(
        `SELECT id, 'memory' AS source_type, title, LEFT(content, 200) AS snippet,
                (1 - (embedding <=> $${paramIndex}::vector)) AS score, tenant_id, tags, created_at
         FROM memories ${where}`,
      );
      unionParams.push(embeddingStr);
      paramIndex++;
    }

    if (scope === 'all' || scope === 'knowledge') {
      const where = tenantConditions.length > 0 ? `WHERE ${tenantConditions.join(' AND ')} AND embedding IS NOT NULL` : 'WHERE embedding IS NOT NULL';
      queries.push(
        `SELECT id, 'knowledge' AS source_type, label AS title, LEFT(summary, 200) AS snippet,
                (1 - (embedding <=> $${paramIndex}::vector)) AS score, tenant_id, tags, created_at
         FROM knowledge_nodes ${where}`,
      );
      unionParams.push(embeddingStr);
      paramIndex++;
    }

    if (queries.length === 0) {
      return { data: [], meta: { total: 0, scope } };
    }

    const combined = queries.join(' UNION ALL ');
    const sql = `SELECT * FROM (${combined}) AS combined
                 WHERE score >= $${paramIndex}
                 ORDER BY score DESC
                 LIMIT $${paramIndex + 1}`;
    const params = [...tenantParams, ...unionParams, minScore, limit];

    const result = await this.db.query<SearchRow>(sql, params);
    const total = result.rows.length;

    this.logger.log({ query: dto.query, scope, total }, 'Unified search completed');
    return {
      data: result.rows,
      meta: { total, scope, minScore },
    };
  }

  async suggest(dto: SuggestQueryDto): Promise<{ data: { title: string; sourceType: string; count: number }[] }> {
    const limit = dto.limit ?? 10;
    const prefix = `${dto.prefix}%`;

    const result = await this.db.query<{ title: string; source_type: string; count: string }>(
      `SELECT title, source_type, count(*) FROM (
         SELECT title, 'memory' AS source_type FROM memories WHERE title ILIKE $1
         UNION ALL
         SELECT label AS title, 'knowledge' AS source_type FROM knowledge_nodes WHERE label ILIKE $1
       ) AS s
       GROUP BY title, source_type
       ORDER BY count DESC, title ASC
       LIMIT $2`,
      [prefix, limit],
    );

    return {
      data: result.rows.map((r) => ({
        title: r.title,
        sourceType: r.source_type,
        count: Number(r.count),
      })),
    };
  }

  async reindex(dto: IndexDto): Promise<{ jobId: string; message: string }> {
    const tenantFilter = dto.tenantIds && dto.tenantIds.length > 0 ? dto.tenantIds : [];
    const jobId = randomUUID();

    const aiUrl = this.config.get<string>('ai.serviceUrl') as string;
    const endpoint = this.config.get<string>('ai.embeddingEndpoint') as string;

    const url = `${aiUrl}${endpoint}/reindex`;

    try {
      await firstValueFrom(
        this.http
          .post(
            url,
            { tenantIds: tenantFilter, force: dto.force ?? false },
            { timeout: this.embeddingTimeoutMs },
          )
          .pipe(
            timeout(this.embeddingTimeoutMs),
            catchError((err) => {
              throw err;
            }),
          ),
      );
    } catch (err) {
      this.logger.error({ err, jobId }, 'Reindex request to AI service failed');
      throw new InternalServerErrorException('Failed to trigger embedding reindex');
    }

    this.logger.log({ jobId, tenantFilter }, 'Reindex triggered');
    return { jobId, message: 'Reindex job accepted by AI service' };
  }

  async recordFeedback(dto: SearchFeedbackDto): Promise<{ id: string; message: string }> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const userId = this.requestContext.userId ?? null;
    const id = randomUUID();

    const result = await this.db.query(
      `INSERT INTO search_feedback (id, result_id, source_type, query, rating, tenant_id, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [id, dto.resultId, dto.sourceType, dto.query ?? null, dto.rating ?? null, tenantId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Could not record feedback');
    }

    this.logger.log({ id, resultId: dto.resultId }, 'Search feedback recorded');
    return { id, message: 'Feedback recorded' };
  }

  private async computeEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return new Array(1536).fill(0);
    }

    const aiUrl = this.config.get<string>('ai.serviceUrl') as string;
    const endpoint = this.config.get<string>('ai.embeddingEndpoint') as string;

    try {
      const response = await firstValueFrom(
        this.http
          .post(
            `${aiUrl}${endpoint}`,
            { text: text.slice(0, 8192) },
            { timeout: this.embeddingTimeoutMs },
          )
          .pipe(
            timeout(this.embeddingTimeoutMs),
            catchError((err) => {
              throw err;
            }),
          ),
      );

      const body = response.data as { embedding?: number[]; data?: { embedding: number[] }[] };
      const embedding = 'data' in body ? (body.data?.[0]?.embedding ?? null) : body.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response');
      }
      return embedding;
    } catch (err) {
      this.logger.warn({ err }, 'Embedding failed, using zero vector');
      return new Array(1536).fill(0);
    }
  }
}
