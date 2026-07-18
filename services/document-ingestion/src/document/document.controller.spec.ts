import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { SourceType, type IngestDocumentDto } from './dto/ingest-document.dto';
import type { QueryDocumentDto } from './dto/query-document.dto';

describe('DocumentController', () => {
  let controller: DocumentController;
  let service: DocumentService;

  const mockDocument = {
    id: '33333333-3333-3333-3333-333333333333',
    type: 'document',
    status: 'INDEXED',
    title: 'Test Doc',
    content: 'a'.repeat(2500),
    content_hash: 'hash',
    size: 2500,
    metadata: '{}',
    tenant_id: 'default',
    workspace_id: null,
    source_type: 'upload',
    source_uri: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockDb = { query: jest.fn(), getPool: jest.fn(), onModuleDestroy: jest.fn() };
  const mockHttp = { get: jest.fn(), post: jest.fn() };
  const mockConfigValues: Record<string, unknown> = {
    'ai.serviceUrl': 'http://ai-service:8000',
    'ai.embeddingEndpoint': '/api/v1/embeddings',
    'ai.embeddingDimension': 1536,
    'chunking.size': 1000,
    'chunking.overlap': 200,
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as ConfigService;
  const mockRequestContext = {
    correlationId: 'test',
    userId: undefined,
    tenantId: 'default',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };
  const mockMetrics = { recordEvent: jest.fn(), recordHttpRequest: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        DocumentService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    service = module.get<DocumentService>(DocumentService);
    mockHttp.post.mockReturnValue(of({ data: { embedding: new Array(1536).fill(0) } }));
  });

  describe('chunkText', () => {
    it('should produce overlapping chunks for long text', () => {
      const chunks = service.chunkText('x'.repeat(2500));
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]!.length).toBe(1000);
    });

    it('should return single chunk for short text', () => {
      const chunks = service.chunkText('short text');
      expect(chunks).toHaveLength(1);
    });
  });

  describe('ingest', () => {
    it('should ingest a document with content', async () => {
      const dto: IngestDocumentDto = {
        title: 'Test Doc',
        content: 'a'.repeat(2500),
        sourceType: SourceType.UPLOAD,
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockDocument] })
        .mockResolvedValue({ rows: [] });

      const result = await controller.ingest(dto);
      expect(result.status).toBe('INDEXED');
      expect(result.chunkCount).toBeGreaterThan(0);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memories'),
        expect.arrayContaining([dto.title]),
      );
    });

    it('should reject empty content', async () => {
      const dto: IngestDocumentDto = {
        title: 'Empty',
        content: '   ',
        sourceType: SourceType.UPLOAD,
      };
      await expect(controller.ingest(dto)).rejects.toThrow('content');
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      const query: QueryDocumentDto = { page: 1, pageSize: 20 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockDocument] });

      const result = await controller.findAll(query);
      expect(result.data).toEqual([mockDocument]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a document with chunks', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockDocument] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await controller.findOne(mockDocument.id);
      expect(result.id).toBe(mockDocument.id);
      expect(result.chunks).toEqual([]);
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      await expect(controller.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('chunks', () => {
    it('should list chunks', async () => {
      const chunk = {
        id: 'c1',
        document_id: mockDocument.id,
        content: 'chunk',
        chunk_index: 0,
        created_at: new Date(),
      };
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockDocument] })
        .mockResolvedValueOnce({ rows: [chunk] });

      const result = await controller.chunks(mockDocument.id);
      expect(result).toHaveLength(1);
    });
  });

  describe('reprocess', () => {
    it('should reprocess a document', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockDocument] })
        .mockResolvedValue({ rows: [] });

      const result = await controller.reprocess(mockDocument.id);
      expect(result.status).toBe('INDEXED');
    });
  });
});
