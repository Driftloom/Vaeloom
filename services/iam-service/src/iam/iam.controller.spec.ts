import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { AssignRolesDto, CreateUserDto } from './dto/iam.dto';

describe('IamController', () => {
  let controller: IamController;
  let service: IamService;

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };
  const mockConfigValues: Record<string, unknown> = {
    'auth.secret': 'test-secret-key-1234567890',
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as unknown as ConfigService;
  const mockRequestContext = {
    correlationId: 'cid',
    tenantId: 'default',
    userId: undefined,
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  const userRow = {
    id: 'u1',
    email: 'a@b.com',
    display_name: 'A',
    tenant_id: 't1',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IamController],
      providers: [
        IamService,
        JwtAuthGuard,
        { provide: ConfigService, useValue: mockConfig },
        { provide: DatabaseService, useValue: mockDb },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    controller = module.get(IamController);
    service = module.get(IamService);
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto: CreateUserDto = {
        email: 'a@b.com',
        displayName: 'A',
        tenantId: 't1',
        roleIds: ['r1'],
      };
      mockDb.query
        .mockResolvedValueOnce({ rows: [userRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'admin' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'admin' }] });
      const result = await controller.create(dto);
      expect(result.id).toBe('u1');
      expect(result.roles).toContainEqual({ id: 'r1', name: 'admin' });
    });

    it('should reject unknown role', async () => {
      const dto: CreateUserDto = { email: 'a@b.com', displayName: 'A', tenantId: 't1', roleIds: ['bad'] };
      mockDb.query
        .mockResolvedValueOnce({ rows: [userRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] });
      await expect(controller.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('should return paginated users', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await controller.list({ page: 1, pageSize: 20, tenantId: 't1' });
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should return a user', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await controller.get('u1');
      expect(result.id).toBe('u1');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const result = await controller.remove('u1');
      expect(result).toEqual({ message: 'User deactivated' });
    });

    it('should throw when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });
      await expect(controller.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeRole', () => {
    it('should throw when role not assigned', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rowCount: 0 });
      await expect(controller.removeRole('u1', 'r9')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('permissions', () => {
    it('should compute effective permissions', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({
          rows: [{ permission: '[{"resource":"doc","action":"read"}]' }],
        });
      const result = await controller.permissions('u1');
      expect(result.permissions).toContainEqual({ resource: 'doc', action: 'read' });
    });
  });
});
