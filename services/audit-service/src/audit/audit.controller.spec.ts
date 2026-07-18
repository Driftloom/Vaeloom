import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { AuditController } from './audit.controller';
import { AuditService, type AuditRow } from './audit.service';
import { RecordAuditEventDto, QueryAuditEventsDto, ExportAuditDto, ComplianceReportQueryDto } from './dto/audit.dto';

describe('AuditController', () => {
  let controller: AuditController;
  let service: AuditService;

  const mockRow: AuditRow = {
    id: 'audit-1',
    actor_id: 'user-1',
    action: 'memory.delete',
    resource: 'memory',
    resource_id: 'mem-1',
    tenant_id: 'default',
    metadata: { ip: '1.2.3.4' },
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  };

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
      controllers: [AuditController],
      providers: [
        AuditService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get<AuditService>(AuditService);
  });

  describe('record', () => {
    it('should append an immutable audit event', async () => {
      const dto: RecordAuditEventDto = { actorId: 'user-1', action: 'memory.delete', resource: 'memory', resourceId: 'mem-1' };
      mockDb.query!.mockResolvedValue({ rows: [mockRow] });
      const result = await controller.record(dto);
      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_events'),
        expect.arrayContaining([dto.actorId, dto.action, dto.resource]),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated audit events', async () => {
      const query: QueryAuditEventsDto = { page: 1, pageSize: 20 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockRow] });
      const result = await controller.findAll(query);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single audit event', async () => {
      mockDb.query!.mockResolvedValue({ rows: [mockRow] });
      const result = await controller.findOne(mockRow.id);
      expect(result).toEqual(mockRow);
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query!.mockResolvedValue({ rows: [] });
      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('export', () => {
    it('should export audit events as JSON', async () => {
      const dto: ExportAuditDto = { dateFrom: '2026-01-01', dateTo: '2026-01-31', format: 'json' };
      mockDb.query!.mockResolvedValue({ rows: [mockRow] });
      const result = await controller.export(dto);
      expect(result.format).toBe('json');
      expect(result.content).toContain(mockRow.id);
    });

    it('should export audit events as CSV', async () => {
      const dto: ExportAuditDto = { dateFrom: '2026-01-01', dateTo: '2026-01-31', format: 'csv' };
      mockDb.query!.mockResolvedValue({ rows: [mockRow] });
      const result = await controller.export(dto);
      expect(result.format).toBe('csv');
      expect(result.content.startsWith('id,actor_id')).toBe(true);
    });
  });

  describe('complianceReport', () => {
    it('should return summary counts', async () => {
      const query: ComplianceReportQueryDto = {};
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ action: 'memory.delete', count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ resource: 'memory', count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] });
      const result = await controller.complianceReport(query);
      expect(result.total).toBe(3);
      expect(result.byAction[0]!.action).toBe('memory.delete');
    });
  });
});
