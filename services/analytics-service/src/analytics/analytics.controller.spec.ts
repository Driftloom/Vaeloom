import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UsageQueryDto, TrackEventDto, AggregateDto } from './dto/analytics.dto';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockConfig = { get: jest.fn() } as unknown as ConfigService;

  const mockRequestContext = {
    correlationId: 'cid',
    userId: undefined,
    tenantId: 'default',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        AnalyticsService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('usage', () => {
    it('should return time-series usage points', async () => {
      const dto: UsageQueryDto = { interval: 'day' };
      mockDb.query!.mockResolvedValue({
        rows: [{ date: '2026-01-01', memories_created: '5', agents_run: '2', tokens_used: '1200' }],
      });
      const result = await controller.usage(dto);
      expect(result.data[0]!.memoriesCreated).toBe(5);
    });
  });

  describe('metrics', () => {
    it('should return aggregated KPIs', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ avg: '150.5' }] });
      const result = await controller.metrics();
      expect(result.totalMemories).toBe(10);
      expect(result.avgResponseTimeMs).toBe(151);
    });
  });

  describe('trackEvent', () => {
    it('should track a custom event', async () => {
      const dto: TrackEventDto = { name: 'export_triggered', properties: { a: 1 } };
      mockDb.query!.mockResolvedValue({ rows: [{ id: 'evt-1' }] });
      const result = await controller.trackEvent(dto);
      expect(result.id).toBeDefined();
      expect(result.message).toBe('Event tracked');
    });
  });

  describe('dashboard', () => {
    it('should return a combined dashboard payload', async () => {
      mockDb.query!.mockImplementation((sql: string) => {
        if (sql.includes('generate_series')) {
          return Promise.resolve({ rows: [{ date: '2026-01-01', memories_created: '1', agents_run: '1', tokens_used: '1' }] });
        }
        if (sql.includes('COUNT(*) AS count FROM memories')) {
          return Promise.resolve({ rows: [{ count: '10' }] });
        }
        if (sql.includes('COUNT(*) AS count FROM agents')) {
          return Promise.resolve({ rows: [{ count: '3' }] });
        }
        if (sql.includes('DISTINCT user_id')) {
          return Promise.resolve({ rows: [{ count: '4' }] });
        }
        if (sql.includes('AVG(duration_ms)')) {
          return Promise.resolve({ rows: [{ avg: '100' }] });
        }
        return Promise.resolve({ rows: [] });
      });
      const result = await controller.dashboard();
      expect(result.kpis.totalMemories).toBe(10);
      expect(result.usage).toHaveLength(1);
    });
  });

  describe('aggregate', () => {
    it('should run daily aggregation and return counts', async () => {
      const dto: AggregateDto = { date: '2026-01-01' };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ sum: '500' }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const result = await controller.aggregate(dto);
      expect(result.date).toBe('2026-01-01');
      expect(result.recordsCreated).toBe(1);
    });
  });
});
