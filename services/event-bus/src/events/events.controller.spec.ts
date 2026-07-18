import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let db: jest.Mocked<DatabaseService>;

  const mockDb = {
    query: jest.fn(),
  };

  const mockConfig = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    db = module.get(DatabaseService) as jest.Mocked<DatabaseService>;
  });

  describe('publish', () => {
    it('should insert an event and attempt delivery', async () => {
      const dto = {
        type: 'test.event',
        source: 'test',
        category: 'system' as const,
        priority: 'normal',
        payload: { key: 'value' },
        tenantId: 'tenant-1',
      };

      const insertedEvent = {
        id: 'new-uuid',
        type: 'test.event',
        status: 'PUBLISHED',
      };

      // Insert query
      mockDb.query.mockResolvedValueOnce({ rows: [insertedEvent] } as any);
      // Update to PROCESSING
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      // Find subscriptions
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      // Update to COMPLETED
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.publish(dto);
      expect(result.id).toBe('new-uuid');
      expect(mockDb.query).toHaveBeenCalledTimes(4);
      expect(mockDb.query.mock.calls[0][0]).toContain('INSERT INTO events');
    });
  });

  describe('findById', () => {
    it('should return event when found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'uuid-1', type: 'test' }] } as any);
      const result = await service.findById('uuid-1');
      expect(result.id).toBe('uuid-1');
    });

    it('should throw when not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(service.findById('bad')).rejects.toThrow('Event bad not found');
    });
  });

  describe('createSubscription', () => {
    it('should insert and return subscription', async () => {
      const dto = { eventType: 'test.event', handlerId: 'handler-1' };
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'sub-uuid', event_type: 'test.event' }] } as any);

      const result = await service.createSubscription(dto);
      expect(result.id).toBe('sub-uuid');
    });
  });

  describe('deleteSubscription', () => {
    it('should delete and return result', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] } as any);
      const result = await service.deleteSubscription('sub-1');
      expect(result).toEqual({ deleted: true });
    });

    it('should throw when not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(service.deleteSubscription('bad')).rejects.toThrow('Subscription bad not found');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '2' }] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'e1' }, { id: 'e2' }] } as any);

      const result = await service.findAll({ page: 1, pageSize: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
