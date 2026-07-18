import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';
import { GenerateRecommendationDto } from './dto/generate-recommendation.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { TrendingQueryDto } from './dto/trending-query.dto';
import { IndexDto } from './dto/index.dto';

describe('RecommendationService', () => {
  let service: RecommendationService;

  const recRow = {
    id: 'rec-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    items: JSON.stringify([
      { id: 'm1', type: 'memory', title: 'Memory A', score: 0.9, source: 'memory', metadata: {} },
    ]),
    model_version: 'vector-v1',
    created_at: new Date(),
  };

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockMetrics = {
    recommendationsGenerated: { inc: jest.fn() },
    feedbackRecorded: { inc: jest.fn() },
    indexRebuilds: { inc: jest.fn() },
    modelLatency: { observe: jest.fn() },
  };

  const mockConfigValues: Record<string, unknown> = {
    'ai.embeddingDimension': 1536,
    'ai.serviceUrl': 'http://ai-service:8000',
    'ai.personalizationEndpoint': '/api/v1/personalize',
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as ConfigService;

  const mockRequestContext = {
    correlationId: 'cid',
    userId: 'user-1',
    tenantId: 'tenant-1',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: MetricsService, useValue: mockMetrics },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  describe('generate', () => {
    it('should generate and persist recommendations', async () => {
      const dto: GenerateRecommendationDto = { userId: 'user-1', topN: 5 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // memory preference vector
        .mockResolvedValueOnce({ rows: [] }) // node preference vector
        .mockResolvedValueOnce({ rows: [] }) // memory candidates
        .mockResolvedValueOnce({ rows: [] }) // node candidates
        .mockResolvedValueOnce({ rows: [recRow] }); // insert

      const result = await service.generate(dto);
      expect(result).toEqual(recRow);
      expect(mockMetrics.recommendationsGenerated.inc).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
      });
    });

    it('should rank candidates and return top-N items', async () => {
      const dto: GenerateRecommendationDto = { userId: 'user-1', topN: 2 };
      const candidate = {
        id: 'm1',
        type: 'memory',
        title: 'Memory A',
        summary: 's',
        source: 'memory',
        metadata: { tags: ['x'] },
        distance: 0.8,
        importance: 0.9,
        recency: 30,
        usageCount: 5,
      };
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [candidate] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [recRow] });

      const result = await service.generate(dto);
      const parsed = JSON.parse(result.items);
      expect(parsed).toHaveLength(1);
    });
  });

  describe('getByUser', () => {
    it('should return stored recommendations for user', async () => {
      mockDb.query.mockResolvedValue({ rows: [recRow] });
      const result = await service.getByUser('user-1');
      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM recommendations'),
        ['user-1', 'tenant-1'],
      );
    });
  });

  describe('recordFeedback', () => {
    it('should persist feedback and increment metric', async () => {
      const dto: FeedbackDto = { recommendationId: 'rec-1', useful: true };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'rec-1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'fb-1', recommendation_id: 'rec-1', user_id: 'user-1', tenant_id: 'tenant-1', useful: true, created_at: new Date() }],
        });

      const result = await service.recordFeedback(dto);
      expect(result.useful).toBe(true);
      expect(mockMetrics.feedbackRecorded.inc).toHaveBeenCalled();
    });

    it('should throw NotFoundException when recommendation missing', async () => {
      const dto: FeedbackDto = { recommendationId: 'missing', useful: false };
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(service.recordFeedback(dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getTrending', () => {
    it('should merge and sort trending items', async () => {
      const queryDto: TrendingQueryDto = { limit: 10 };
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'm1', type: 'memory', title: 'A', summary: null, metadata: '{}', usage_count: '10' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'k1', type: 'knowledge_node', title: 'B', summary: null, metadata: '{}', usage_count: '4' }],
        });

      const result = await service.getTrending(queryDto);
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('m1');
    });
  });

  describe('reindex', () => {
    it('should rebuild preference vectors for tenant users', async () => {
      const dto: IndexDto = {};
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })
        .mockResolvedValueOnce({ rows: [] }) // computeAggregatePreference avg
        .mockResolvedValueOnce({ rowCount: 1 }); // upsert

      const result = await service.reindex(dto);
      expect(result.userIds).toBe(1);
      expect(mockMetrics.indexRebuilds.inc).toHaveBeenCalled();
    });
  });
});
