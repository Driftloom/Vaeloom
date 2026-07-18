import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { SchedulerService } from './scheduler.service';

describe('JobController', () => {
  let controller: JobController;
  let service: JobService;

  const mockJob = {
    id: '99999999-9999-9999-9999-999999999999',
    name: 'Cleanup',
    type: 'http' as const,
    cron: '0 */6 * * *',
    method: 'POST',
    url: 'http://localhost:9999/run',
    event: null,
    payload: { a: 1 },
    headers: { 'x-test': '1' },
    status: 'active' as const,
    last_run_at: null,
    next_run_at: null,
    tenant_id: 'default',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockDb = { query: jest.fn(), getPool: jest.fn(), onModuleDestroy: jest.fn() };
  const mockScheduler = {
    reload: jest.fn().mockResolvedValue(undefined),
    triggerNow: jest.fn().mockResolvedValue({ jobId: mockJob.id, status: 'triggered' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobController],
      providers: [
        JobService,
        { provide: SchedulerService, useValue: mockScheduler },
        { provide: DatabaseService, useValue: mockDb },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'scheduler.eventBusUrl' ? 'http://event-bus:3040' : undefined) },
        },
        {
          provide: MetricsService,
          useValue: {
            recordEvent: jest.fn(),
            recordHttpRequest: jest.fn(),
            observeHttpDuration: jest.fn(),
            incActiveConnections: jest.fn(),
            decActiveConnections: jest.fn(),
            getMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<JobController>(JobController);
    service = module.get<JobService>(JobService);
  });

  describe('create', () => {
    it('should create a job and reload scheduler', async () => {
      const dto: CreateJobDto = {
        name: 'Cleanup',
        type: 'http',
        cron: '0 */6 * * *',
        method: 'POST',
        url: 'http://localhost:9999/run',
      };
      mockDb.query.mockResolvedValue({ rows: [mockJob] });

      const result = await controller.create(dto);
      expect(result).toEqual(mockJob);
      expect(mockScheduler.reload).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated list', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockJob] });

      const result = await controller.findAll({ page: 1, pageSize: 20 });
      expect(result.data).toEqual([mockJob]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(controller.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pause/resume', () => {
    it('should pause a job', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockJob] })
        .mockResolvedValueOnce({ rows: [{ ...mockJob, status: 'paused' }] });

      const result = await controller.pause(mockJob.id);
      expect(result.status).toBe('paused');
    });

    it('should resume a job', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockJob] })
        .mockResolvedValueOnce({ rows: [{ ...mockJob, status: 'active' }] });

      const result = await controller.resume(mockJob.id);
      expect(result.status).toBe('active');
    });
  });

  describe('trigger', () => {
    it('should trigger a job now', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockJob] });
      const result = await controller.trigger(mockJob.id);
      expect(result.status).toBe('triggered');
      expect(mockScheduler.triggerNow).toHaveBeenCalledWith(mockJob.id);
    });
  });

  describe('executions', () => {
    it('should list executions', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockJob] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await controller.executions(mockJob.id);
      expect(result).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should delete a job', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockJob] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await controller.remove(mockJob.id);
      expect(result).toEqual({ message: 'Job deleted successfully' });
    });
  });
});
