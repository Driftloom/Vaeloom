import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { PluginController } from './plugin.controller';
import { PluginService } from './plugin.service';
import { SandboxService } from './sandbox.service';
import { RegisterPluginDto } from './dto/register-plugin.dto';
import { QueryPluginDto } from './dto/query-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import { ExecutePluginDto } from './dto/execute-plugin.dto';

describe('PluginService', () => {
  let service: PluginService;
  let sandbox: SandboxService;

  const pluginRow = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'alice@example.com',
    license: 'MIT',
    min_app_version: '1.0.0',
    status: 'REGISTERED',
    permissions: '{"memory":["read"]}',
    capabilities: ['memory:read'],
    hooks: ['onMemoryCreated'],
    tags: ['test'],
    entry_point: 'dist/index.js',
    tenant_id: 'tenant-1',
    homepage: null,
    repository: null,
    icon: null,
    config_schema: null,
    code: 'return { ok: true };',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockSandbox = {
    run: jest.fn(),
  };

  const mockMetrics = {
    activePlugins: { inc: jest.fn(), dec: jest.fn() },
    sandboxExecutions: { inc: jest.fn() },
    sandboxFailures: { inc: jest.fn() },
  };

  const mockConfigValues: Record<string, unknown> = {
    'plugin.sandboxTimeoutMs': 5000,
    'plugin.storeDirectory': 'plugins',
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as ConfigService;

  const mockRequestContext = {
    correlationId: 'cid',
    userId: 'user-1',
    tenantId: 'tenant-1',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: SandboxService, useValue: mockSandbox },
        { provide: MetricsService, useValue: mockMetrics },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    service = module.get<PluginService>(PluginService);
    sandbox = module.get<SandboxService>(SandboxService);
  });

  describe('register', () => {
    it('should insert a plugin and return the row', async () => {
      const dto: RegisterPluginDto = {
        name: 'test-plugin',
        version: '1.0.0',
        author: 'alice@example.com',
        description: 'A test plugin',
        license: 'MIT',
        minAppVersion: '1.0.0',
        tags: ['test'],
        permissions: { memory: ['read'] },
        capabilities: ['memory:read'],
        hooks: ['onMemoryCreated'],
        entryPoint: 'dist/index.js',
        tenantId: 'tenant-1',
      };
      mockDb.query.mockResolvedValue({ rows: [pluginRow] });

      const result = await service.register(dto);
      expect(result).toEqual(pluginRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plugins'),
        expect.arrayContaining([dto.name, dto.version]),
      );
      expect(mockMetrics.activePlugins.inc).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated plugins', async () => {
      const queryDto: QueryPluginDto = { page: 1, pageSize: 20 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [pluginRow] });

      const result = await service.findAll(queryDto);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply status filter', async () => {
      const queryDto: QueryPluginDto = { page: 1, pageSize: 20, status: 'ACTIVE' as never };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.findAll(queryDto);
      expect(mockDb.query.mock.calls[0][0]).toContain('p.status = $1');
      expect(result.data).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return a plugin by id', async () => {
      mockDb.query.mockResolvedValue({ rows: [pluginRow] });
      const result = await service.findById(pluginRow.id);
      expect(result.id).toBe(pluginRow.id);
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('should bump version and persist', async () => {
      const dto: UpdatePluginDto = { version: '1.0.1' };
      mockDb.query
        .mockResolvedValueOnce({ rows: [pluginRow] })
        .mockResolvedValueOnce({ rows: [{ ...pluginRow, version: '1.0.1' }] });

      const result = await service.update(pluginRow.id, dto);
      expect(result.version).toBe('1.0.1');
    });
  });

  describe('remove', () => {
    it('should delete an existing plugin', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const result = await service.remove(pluginRow.id);
      expect(result.message).toContain('unregistered');
      expect(mockMetrics.activePlugins.dec).toHaveBeenCalled();
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPermissions', () => {
    it('should return parsed permissions', async () => {
      mockDb.query.mockResolvedValue({ rows: [pluginRow] });
      const result = await service.getPermissions(pluginRow.id);
      expect(result.permissions).toEqual({ memory: ['read'] });
    });
  });

  describe('execute', () => {
    const execDto: ExecutePluginDto = { input: { x: 1 } };

    it('should run sandbox and record a successful execution', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [pluginRow] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'exec-1',
              plugin_id: pluginRow.id,
              status: 'success',
              duration_ms: 5,
              output: '{"ok":true}',
              error_message: null,
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      mockSandbox.run.mockResolvedValue({
        status: 'success',
        output: { ok: true },
        durationMs: 5,
      });

      const result = await service.execute(pluginRow.id, execDto);
      expect(result.status).toBe('success');
      expect(mockSandbox.run).toHaveBeenCalled();
      expect(mockMetrics.sandboxExecutions.inc).toHaveBeenCalledWith({
        plugin_id: pluginRow.id,
        status: 'success',
      });
    });

    it('should record a timeout execution', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [pluginRow] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'exec-2',
              plugin_id: pluginRow.id,
              status: 'timeout',
              duration_ms: 5000,
              output: 'null',
              error_message: 'timeout',
              created_at: new Date(),
            },
          ],
        });

      mockSandbox.run.mockResolvedValue({
        status: 'timeout',
        output: null,
        durationMs: 5000,
        errorMessage: 'timeout',
      });

      const result = await service.execute(pluginRow.id, execDto);
      expect(result.status).toBe('timeout');
      expect(mockMetrics.sandboxFailures.inc).toHaveBeenCalled();
    });

    it('should reject execution for disabled plugins', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...pluginRow, status: 'DISABLED' }],
      });
      await expect(service.execute(pluginRow.id, execDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw when no code is available', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ ...pluginRow, code: null, entry_point: '' }],
      });
      await expect(service.execute(pluginRow.id, execDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
