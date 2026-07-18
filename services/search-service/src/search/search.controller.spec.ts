import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchQueryDto, SuggestQueryDto, SearchFeedbackDto, IndexDto } from './dto/search.dto';

describe('SearchController', () => {
  let controller: SearchController;
  let service: SearchService;

  const mockRow = {
    id: 'row-1',
    source_type: 'memory' as const,
    title: 'Test Memory',
    snippet: 'snip',
    score: 0.9,
    tenant_id: 'default',
    tags: ['t'],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockConfigValues: Record<string, unknown> = {
    'ai.serviceUrl': 'http://ai-service:8000',
    'ai.embeddingEndpoint': '/api/v1/embeddings',
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as ConfigService;

  const mockRequestContext = {
    correlationId: 'cid',
    userId: undefined,
    tenantId: 'default',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  const mockHttp = { post: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        SearchService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    service = module.get<SearchService>(SearchService);

    const srv = service as unknown as Record<string, jest.Mock>;
    srv.computeEmbedding = jest.fn().mockResolvedValue(new Array(1536).fill(0.1));
  });

  describe('search', () => {
    it('should return merged ranked results', async () => {
      const dto: SearchQueryDto = { query: 'hello' };
      mockDb.query!.mockResolvedValue({ rows: [mockRow] });
      const result = await controller.search(dto);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('suggest', () => {
    it('should return suggestions from titles', async () => {
      const dto: SuggestQueryDto = { prefix: 'te' };
      mockDb.query!.mockResolvedValue({ rows: [{ title: 'Test', source_type: 'memory', count: '3' }] });
      const result = await controller.suggest(dto);
      expect(result.data[0]!.title).toBe('Test');
    });
  });

  describe('reindex', () => {
    it('should trigger reindex via AI service', async () => {
      const dto: IndexDto = { force: true };
      mockHttp.post.mockReturnValue(of({ data: { ok: true } }));
      const result = await controller.reindex(dto);
      expect(result.jobId).toBeDefined();
    });

    it('should error when AI service fails', async () => {
      const dto: IndexDto = {};
      mockHttp.post.mockReturnValue(throwError(() => new Error('boom')));
      await expect(controller.reindex(dto)).rejects.toBeDefined();
    });
  });

  describe('feedback', () => {
    it('should record feedback', async () => {
      const dto: SearchFeedbackDto = { resultId: 'r1', sourceType: 'memory', rating: 5 };
      mockDb.query!.mockResolvedValue({ rows: [{ id: 'f-1' }] });
      const result = await controller.feedback(dto);
      expect(result.id).toBeDefined();
      expect(result.message).toBe('Feedback recorded');
    });

    it('should throw NotFoundException when insert fails', async () => {
      const dto: SearchFeedbackDto = { resultId: 'r1', sourceType: 'knowledge' };
      mockDb.query!.mockResolvedValue({ rows: [] });
      await expect(controller.feedback(dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
