import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';
import { ConnectorType, type CreateConnectorDto } from './dto/create-connector.dto';
import type { QueryConnectorDto } from './dto/query-connector.dto';
import type { UpdateConnectorDto } from './dto/update-connector.dto';

describe('ConnectorController', () => {
  let controller: ConnectorController;

  const mockConnector = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test REST',
    type: 'rest',
    status: 'ACTIVE',
    config: JSON.stringify({ url: 'https://api.example.com' }),
    tenant_id: 'default',
    last_sync_status: null,
    last_sync_error: null,
    last_sync_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockDb = { query: jest.fn(), getPool: jest.fn(), onModuleDestroy: jest.fn() };
  const mockHttp = { get: jest.fn(), post: jest.fn() };
  const mockConfigValues: Record<string, unknown> = {
    'integration.serviceUrl': 'http://integration-service:3130',
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
      controllers: [ConnectorController],
      providers: [
        ConnectorService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    controller = module.get<ConnectorController>(ConnectorController);
  });

  describe('create', () => {
    it('should create a connector', async () => {
      const dto: CreateConnectorDto = {
        name: 'Test REST',
        type: ConnectorType.REST,
        config: { url: 'https://api.example.com' },
      };
      mockDb.query.mockResolvedValue({ rows: [mockConnector] });

      const result = await controller.create(dto);
      expect(result).toEqual(mockConnector);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO connectors'),
        expect.arrayContaining([dto.name, dto.type]),
      );
    });

    it('should reject invalid config', async () => {
      const dto: CreateConnectorDto = {
        name: 'Bad',
        type: ConnectorType.REST,
        config: {},
      };
      await expect(controller.create(dto)).rejects.toThrow('url');
    });
  });

  describe('findAll', () => {
    it('should return paginated connectors', async () => {
      const query: QueryConnectorDto = { page: 1, pageSize: 20 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockConnector] });

      const result = await controller.findAll(query);
      expect(result.data).toEqual([mockConnector]);
      expect(result.meta.total).toBe(1);
    });

    it('should apply type filter', async () => {
      const query: QueryConnectorDto = { page: 1, pageSize: 20, type: ConnectorType.REST };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockConnector] });

      const result = await controller.findAll(query);
      expect(result.data).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('type ='),
        expect.arrayContaining(['rest']),
      );
    });
  });

  describe('findOne', () => {
    it('should return a connector', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockConnector] });
      const result = await controller.findOne(mockConnector.id);
      expect(result).toEqual(mockConnector);
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(controller.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a connector', async () => {
      const dto: UpdateConnectorDto = { name: 'Renamed' };
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockConnector] })
        .mockResolvedValueOnce({ rows: [{ ...mockConnector, name: 'Renamed' }] });

      const result = await controller.update(mockConnector.id, dto);
      expect(result.name).toBe('Renamed');
    });
  });

  describe('remove', () => {
    it('should remove a connector', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const result = await controller.remove(mockConnector.id);
      expect(result).toEqual({ message: 'Connector removed successfully' });
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });
      await expect(controller.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sync', () => {
    it('should record a successful sync', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockConnector] })
        .mockResolvedValueOnce({
          rows: [{ ...mockConnector, last_sync_status: 'SUCCESS', last_sync_at: new Date() }],
        });
      mockHttp.post.mockReturnValue(of({ data: {} }));

      const result = await controller.sync(mockConnector.id);
      expect(result.status).toBe('SUCCESS');
    });

    it('should record a failed sync', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockConnector] })
        .mockResolvedValueOnce({
          rows: [{ ...mockConnector, last_sync_status: 'FAILED', last_sync_error: 'boom' }],
        });
      mockHttp.post.mockReturnValue(throwError(() => new Error('boom')));

      const result = await controller.sync(mockConnector.id);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('test', () => {
    it('should validate a REST connection', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockConnector] });
      mockHttp.get.mockReturnValue(of({ data: {} }));

      const result = await controller.test(mockConnector.id);
      expect(result.ok).toBe(true);
    });
  });
});
