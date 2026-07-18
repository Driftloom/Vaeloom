import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { AgentController } from './agent.controller';
import { AgentService, type AgentRow } from './agent.service';
import { RegisterAgentDto } from './dto/agent.dto';

describe('AgentController', () => {
  let controller: AgentController;
  let service: AgentService;

  const mockAgent: AgentRow = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test Agent',
    category: 'retrieval',
    config: {},
    capabilities: ['search'],
    permissions: ['memory:read'],
    active: true,
    tenant_id: 'default',
    owner_id: null,
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
    'eventBus.serviceUrl': 'http://event-bus:3085',
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

  const mockHttp = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        AgentService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: HttpService, useValue: mockHttp },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    service = module.get<AgentService>(AgentService);
  });

  describe('register', () => {
    it('should register an agent', async () => {
      const dto: RegisterAgentDto = {
        name: 'Test Agent',
        category: 'retrieval',
        config: {},
        capabilities: ['search'],
        permissions: ['memory:read'],
      };
      mockDb.query.mockResolvedValue({ rows: [mockAgent] });

      const result = await controller.register(dto);
      expect(result).toEqual(mockAgent);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        expect.arrayContaining([dto.name, dto.category]),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated agents', async () => {
      const query = { page: 1, pageSize: 20 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockAgent] });

      const result = await controller.findAll(query);
      expect(result.data).toEqual([mockAgent]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return an agent by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockAgent] });
      const result = await controller.findOne(mockAgent.id);
      expect(result).toEqual(mockAgent);
    });

    it('should throw NotFoundException when agent missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an agent', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAgent] })
        .mockResolvedValueOnce({ rows: [{ ...mockAgent, name: 'Renamed' }] });
      const result = await controller.update(mockAgent.id, { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
    });
  });

  describe('deactivate', () => {
    it('should deactivate an agent', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAgent] })
        .mockResolvedValueOnce({ rows: [{ ...mockAgent, active: false }] });
      const result = await controller.deactivate(mockAgent.id);
      expect(result.active).toBe(false);
    });
  });

  describe('run', () => {
    it('should run an agent and record a successful execution', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAgent] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'exec-1',
              agent_id: mockAgent.id,
              input: {},
              output: { ok: true },
              status: 'SUCCESS',
              error: null,
              duration_ms: 10,
              created_at: new Date(),
            },
          ],
        });
      mockHttp.post.mockReturnValue(of({ data: { output: { ok: true } } }));

      const result = await controller.run(mockAgent.id, { input: {} });
      expect(result.status).toBe('SUCCESS');
    });

    it('should throw BadRequestException when running a deactivated agent', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ ...mockAgent, active: false }] });
      await expect(controller.run(mockAgent.id, { input: {} })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('schedule', () => {
    it('should create a schedule for an agent', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockAgent] })
        .mockResolvedValueOnce({ rows: [{ id: 'sched-1', agent_id: mockAgent.id, cron: '0 * * * *', input: {}, enabled: true, created_at: new Date() }] });
      const result = await controller.schedule(mockAgent.id, { cron: '0 * * * *' });
      expect(result.cron).toBe('0 * * * *');
    });
  });
});
