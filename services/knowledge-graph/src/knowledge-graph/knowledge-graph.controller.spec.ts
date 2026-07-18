import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { KnowledgeGraphService } from './knowledge-graph.service';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;
  let db: jest.Mocked<DatabaseService>;

  const mockDb = {
    query: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'app.aiServiceUrl') return 'http://localhost:8000';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<KnowledgeGraphService>(KnowledgeGraphService);
    db = module.get(DatabaseService) as jest.Mocked<DatabaseService>;
  });

  describe('createNode', () => {
    it('should insert a node and return it', async () => {
      const dto = { label: 'Test Node', type: 'concept', tenantId: 'uuid-1' };
      const expected = { id: 'new-uuid', label: 'Test Node', type: 'concept', tenant_id: 'uuid-1' };

      mockDb.query.mockResolvedValueOnce({ rows: [expected] } as any);

      const result = await service.createNode(dto);
      expect(result).toEqual(expected);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query.mock.calls[0][0]).toContain('INSERT INTO knowledge_nodes');
    });
  });

  describe('findNodeById', () => {
    it('should return node when found', async () => {
      const expected = { id: 'uuid-1', label: 'Node', edge_count: 3 };
      mockDb.query.mockResolvedValueOnce({ rows: [expected] } as any);

      const result = await service.findNodeById('uuid-1');
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(service.findNodeById('bad-id')).rejects.toThrow('Node bad-id not found');
    });
  });

  describe('deleteNode', () => {
    it('should delete edges then node', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'uuid-1' }] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.deleteNode('uuid-1');
      expect(result).toEqual({ deleted: true });
      expect(mockDb.query).toHaveBeenCalledTimes(3);
      expect(mockDb.query.mock.calls[1][0]).toContain('DELETE FROM knowledge_edges');
      expect(mockDb.query.mock.calls[2][0]).toContain('DELETE FROM knowledge_nodes');
    });
  });

  describe('findAllNodes', () => {
    it('should return paginated results', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '1' }] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'uuid-1', label: 'Node' }] } as any);

      const result = await service.findAllNodes({ page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });
});
