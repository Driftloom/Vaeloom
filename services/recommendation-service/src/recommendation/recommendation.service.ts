import { randomUUID } from 'node:crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  FeedbackRow,
  PreferenceVectorRow,
  RecommendationItem,
  RecommendationRow,
} from './entities/recommendation.entity';
import { GenerateRecommendationDto } from './dto/generate-recommendation.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { TrendingQueryDto } from './dto/trending-query.dto';
import { IndexDto } from './dto/index.dto';

interface ScoredCandidate {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  source: string;
  metadata: Record<string, unknown>;
  distance: number;
  importance: number;
  recency: number;
  usageCount: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly requestContext: RequestContextService,
  ) {}

  async generate(dto: GenerateRecommendationDto): Promise<RecommendationRow> {
    const tenantId = this.requestContext.tenantId ?? dto.tenantId ?? 'default';
    const topN = dto.topN ?? 10;

    const [memoryEmbedding, nodeEmbedding] = await Promise.all([
      this.getUserPreferenceVector(dto.userId, tenantId, 'memory'),
      this.getUserPreferenceVector(dto.userId, tenantId, 'node'),
    ]);

    const candidates = await this.fetchCandidates(tenantId, memoryEmbedding, nodeEmbedding, topN * 3);

    let ranked = this.rank(candidates, dto.contextTags ?? []);

    if (dto.personalize) {
      ranked = await this.personalize(dto.userId, tenantId, ranked, topN);
    }

    const items: RecommendationItem[] = ranked.slice(0, topN).map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      summary: c.summary ?? undefined,
      score: this.compositeScore(c),
      source: c.source,
      metadata: c.metadata,
    }));

    const id = randomUUID();
    const result = await this.db.query<RecommendationRow>(
      `INSERT INTO recommendations (id, user_id, tenant_id, items, model_version)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING *`,
      [
        id,
        dto.userId,
        tenantId,
        JSON.stringify(items),
        dto.personalize ? 'ai-personalized-v1' : 'vector-v1',
      ],
    );

    this.metrics.recommendationsGenerated.inc({ tenant_id: tenantId });
    this.logger.log({ userId: dto.userId, count: items.length }, 'Recommendations generated');
    return result.rows[0]!;
  }

  async getByUser(userId: string): Promise<RecommendationRow[]> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const result = await this.db.query<RecommendationRow>(
      `SELECT * FROM recommendations WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [userId, tenantId],
    );
    return result.rows;
  }

  async recordFeedback(dto: FeedbackDto): Promise<FeedbackRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const userId = this.requestContext.userId ?? 'anonymous';

    const exists = await this.db.query<{ id: string }>(
      `SELECT id FROM recommendations WHERE id = $1`,
      [dto.recommendationId],
    );
    if (exists.rows.length === 0) {
      throw new NotFoundException(`Recommendation "${dto.recommendationId}" not found`);
    }

    const id = randomUUID();
    const result = await this.db.query<FeedbackRow>(
      `INSERT INTO recommendation_feedback (id, recommendation_id, user_id, tenant_id, useful)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, dto.recommendationId, userId, tenantId, dto.useful],
    );

    this.metrics.feedbackRecorded.inc({ tenant_id: tenantId, useful: String(dto.useful) });
    return result.rows[0]!;
  }

  async getTrending(queryDto: TrendingQueryDto): Promise<RecommendationItem[]> {
    const tenantId = this.requestContext.tenantId ?? queryDto.tenantId ?? 'default';
    const limit = queryDto.limit ?? 20;

    const memories = await this.db.query<RecommendationItem & { usage_count: string }>(
      `SELECT id, 'memory' AS type, title, summary, metadata,
              COALESCE((metadata->>'usageCount')::int, 0) AS usage_count
       FROM memories
       WHERE tenant_id = $1 AND status != 'DELETED'
       ORDER BY usage_count DESC
       LIMIT $2`,
      [tenantId, limit],
    );

    const nodes = await this.db.query<RecommendationItem & { usage_count: string }>(
      `SELECT id, 'knowledge_node' AS type, label AS title, description AS summary, properties AS metadata,
              COALESCE((properties->>'usageCount')::int, 0) AS usage_count
       FROM knowledge_nodes
       WHERE tenant_id = $1
       ORDER BY usage_count DESC
       LIMIT $2`,
      [tenantId, limit],
    );

    const merged = [...memories.rows, ...nodes.rows]
      .map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        summary: r.summary ?? undefined,
        score: Number(r.usage_count),
        source: r.type,
        metadata: r.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return merged;
  }

  async reindex(dto: IndexDto): Promise<{ userIds: number; updatedAt: string }> {
    const tenantId = this.requestContext.tenantId ?? dto.tenantId ?? 'default';

    const where = dto.userId ? 'WHERE user_id = $1 AND tenant_id = $2' : 'WHERE tenant_id = $1';
    const params = dto.userId ? [dto.userId, tenantId] : [tenantId];

    const users = await this.db.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM memories ${where}`,
      params,
    );

    for (const row of users.rows) {
      const vector = await this.computeAggregatePreference(row.user_id, tenantId);
      await this.db.query<PreferenceVectorRow>(
        `INSERT INTO user_preference_vectors (user_id, tenant_id, preference_vector, updated_at)
         VALUES ($1, $2, $3::vector, NOW())
         ON CONFLICT (user_id, tenant_id)
         DO UPDATE SET preference_vector = $3::vector, updated_at = NOW()`,
        [row.user_id, tenantId, `[${vector.join(',')}]`],
      );
    }

    this.metrics.indexRebuilds.inc({ tenant_id: tenantId });
    this.logger.log({ tenantId, count: users.rows.length }, 'Preference index rebuilt');
    return { userIds: users.rows.length, updatedAt: new Date().toISOString() };
  }

  private async getUserPreferenceVector(
    userId: string,
    tenantId: string,
    _source: 'memory' | 'node',
  ): Promise<number[]> {
    const result = await this.db.query<{ preference_vector: string }>(
      `SELECT preference_vector FROM user_preference_vectors WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    const dim = this.config.get<number>('ai.embeddingDimension') ?? 1536;

    if (result.rows.length === 0 || !result.rows[0]!.preference_vector) {
      return new Array(dim).fill(0);
    }

    return this.parseVector(result.rows[0]!.preference_vector);
  }

  private async fetchCandidates(
    tenantId: string,
    memoryEmbedding: number[],
    nodeEmbedding: number[],
    limit: number,
  ): Promise<ScoredCandidate[]> {
    const memoryVec = `[${memoryEmbedding.join(',')}]`;
    const nodeVec = `[${nodeEmbedding.join(',')}]`;

    const memoryResult = await this.db.query<
      ScoredCandidate & { embedding: unknown }
    >(
      `SELECT id, 'memory' AS type, title, summary, metadata,
              COALESCE((metadata->>'importance')::float, 0.5) AS importance,
              EXTRACT(EPOCH FROM NOW() - created_at) / 86400.0 AS recency,
              COALESCE((metadata->>'usageCount')::int, 0) AS usage_count,
              1 - (embedding <=> $1::vector) AS distance
       FROM memories
       WHERE tenant_id = $2 AND status != 'DELETED' AND embedding IS NOT NULL
       ORDER BY distance DESC
       LIMIT $3`,
      [memoryVec, tenantId, limit],
    );

    const nodeResult = await this.db.query<
      ScoredCandidate & { embedding: unknown }
    >(
      `SELECT id, 'knowledge_node' AS type, label AS title, description AS summary, properties AS metadata,
              COALESCE((properties->>'importance')::float, 0.5) AS importance,
              EXTRACT(EPOCH FROM NOW() - created_at) / 86400.0 AS recency,
              COALESCE((properties->>'usageCount')::int, 0) AS usage_count,
              1 - (embedding <=> $1::vector) AS distance
       FROM knowledge_nodes
       WHERE tenant_id = $2 AND embedding IS NOT NULL
       ORDER BY distance DESC
       LIMIT $3`,
      [nodeVec, tenantId, limit],
    );

    const toCandidate = (r: ScoredCandidate): ScoredCandidate => ({
      id: r.id,
      type: r.type,
      title: r.title,
      summary: r.summary,
      source: r.type,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      distance: r.distance,
      importance: r.importance,
      recency: r.recency,
      usageCount: r.usageCount,
    });

    return [...memoryResult.rows, ...nodeResult.rows].map(toCandidate);
  }

  private rank(candidates: ScoredCandidate[], contextTags: string[]): ScoredCandidate[] {
    const weightDistance = 0.5;
    const weightImportance = 0.3;
    const weightRecency = 0.1;
    const weightUsage = 0.1;
    const maxUsage = Math.max(1, ...candidates.map((c) => c.usageCount));
    const maxRecency = Math.max(1, ...candidates.map((c) => c.recency));

    return candidates
      .map((c) => {
        const recencyScore = 1 / (1 + c.recency / maxRecency);
        const usageScore = c.usageCount / maxUsage;
        const ctxBoost = this.contextBoost(c, contextTags);
        const score =
          (weightDistance * c.distance +
            weightImportance * c.importance +
            weightRecency * recencyScore +
            weightUsage * usageScore) *
          (1 + ctxBoost);
        return { ...c, distance: score };
      })
      .sort((a, b) => b.distance - a.distance);
  }

  private contextBoost(c: ScoredCandidate, contextTags: string[]): number {
    if (contextTags.length === 0) return 0;
    const tags: string[] = Array.isArray(c.metadata?.tags)
      ? (c.metadata!.tags as string[])
      : [];
    const overlap = tags.filter((t) => contextTags.includes(t)).length;
    return overlap / contextTags.length;
  }

  private compositeScore(c: ScoredCandidate): number {
    return Number(c.distance.toFixed(4));
  }

  private async personalize(
    userId: string,
    tenantId: string,
    ranked: ScoredCandidate[],
    topN: number,
  ): Promise<ScoredCandidate[]> {
    const url = this.config.get<string>('ai.serviceUrl') as string;
    const endpoint = this.config.get<string>('ai.personalizationEndpoint') as string;

    const start = Date.now();
    try {
      const response = await fetch(`${url}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tenantId,
          candidates: ranked.slice(0, topN * 2).map((c) => ({
            id: c.id,
            type: c.type,
            title: c.title,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`AI personalization returned ${response.status}`);
      }
      const body = (await response.json()) as { ranking?: string[] };
      const order = body.ranking ?? [];
      const byId = new Map(ranked.map((c) => [c.id, c]));
      const reordered = order
        .map((id) => byId.get(id))
        .filter((c): c is ScoredCandidate => Boolean(c));
      const remainder = ranked.filter((c) => !order.includes(c.id));
      this.metrics.modelLatency.observe({ tenant_id: tenantId }, (Date.now() - start) / 1000);
      return [...reordered, ...remainder];
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'Personalization failed, using vector ranking');
      return ranked;
    }
  }

  private async computeAggregatePreference(userId: string, tenantId: string): Promise<number[]> {
    const dim = this.config.get<number>('ai.embeddingDimension') ?? 1536;
    const result = await this.db.query<{ avg: string }>(
      `SELECT AVG(embedding)::text AS avg
       FROM memories
       WHERE tenant_id = $1 AND user_id = $2 AND status != 'DELETED' AND embedding IS NOT NULL`,
      [tenantId, userId],
    );

    const avg = result.rows[0]?.avg;
    if (!avg) {
      return new Array(dim).fill(0);
    }
    return this.parseVector(avg);
  }

  private parseVector(raw: string): number[] {
    const trimmed = raw.replace(/^\[/, '').replace(/\]$/, '').trim();
    if (!trimmed) return [];
    return trimmed.split(',').map((s) => Number(s.trim()));
  }
}
