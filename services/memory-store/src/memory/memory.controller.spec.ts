import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

describe('MemoryController', () => {
  let controller: MemoryController;
  let service: MemoryService;

  const mockMemory = {
    id: '22222222-2222-2222-2222-222222222222',
    type: 'note' as const,
    status: 'INDEXED' as const,
    title: 'Test Memory',
    summary: null,
    content: 'Test content',
    content_hash: 'abc123',
    size: 12,
    metadata: '{}',
    tags: ['test'],
    tenant_id: 'default',
    user_id: null,
    workspace_id: null,
    source_type: null,
    source_uri: null,
    source_label: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
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
    correlationId: 'test-correlation-id',
    userId: undefined,
    tenantId: 'default',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [
        MemoryService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
    service = module.get<MemoryService>(MemoryService);

    // Override computeEmbedding to avoid external calls
    const srv = service as unknown as Record<string, jest.Mock>;
    srv.computeEmbedding = jest.fn().mockResolvedValue(new Array(1536).fill(0));
  });

  describe('create', () => {
    it('should create a memory', async () => {
      const dto: CreateMemoryDto = {
        type: 'note' as never,
        title: 'Test Memory',
        content: 'Test content',
        tags: ['test'],
      };

      mockDb.query.mockResolvedValue({ rows: [mockMemory] });

      const result = await controller.create(dto);
      expect(result).toEqual(mockMemory);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memories'),
        expect.arrayContaining([dto.type, dto.title]),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated memories', async () => {
      const queryDto: QueryMemoryDto = { page: 1, pageSize: 20 };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockMemory] });

      const result = await controller.findAll(queryDto);
      expect(result.data).toEqual([mockMemory]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply filters when provided', async () => {
      const queryDto: QueryMemoryDto = {
        page: 1,
        pageSize: 20,
        types: ['note'],
        tags: ['test'],
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockMemory] });

      const result = await controller.findAll(queryDto);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a memory by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockMemory] });

      const result = await controller.findOne(mockMemory.id);
      expect(result).toEqual(mockMemory);
    });

    it('should throw NotFoundException when memory not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(controller.findOne('nonexistent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a memory', async () => {
      const dto: UpdateMemoryDto = { title: 'Updated Title' };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockMemory] })
        .mockResolvedValueOnce({ rows: [{ ...mockMemory, title: 'Updated Title' }] });

      const result = await controller.update(mockMemory.id, dto);
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('remove', () => {
    it('should soft-delete a memory', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await controller.remove(mockMemory.id);
      expect(result).toEqual({ message: 'Memory deleted successfully' });
    });

    it('should throw NotFoundException when memory not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      await expect(controller.remove('nonexistent')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('search', () => {
    it('should perform vector similarity search', async () => {
      const dto: SearchMemoryDto = { query: 'test query', limit: 10 };
      const mockScoredMemory = { ...mockMemory, distance: 0.15 };

      mockDb.query.mockResolvedValue({ rows: [mockScoredMemory] });

      const result = await controller.search(dto);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter results by minScore', async () => {
      const dto: SearchMemoryDto = { query: 'test', limit: 10, minScore: 0.9 };

      const lowScore = { ...mockMemory, distance: 2.0 };
      mockDb.query.mockResolvedValue({ rows: [lowScore] });

      const result = await controller.search(dto);
      expect(result.data).toHaveLength(0);
    });
  });
});
