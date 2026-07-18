import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacController, RoleController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { AddPermissionDto, CheckPermissionDto, CreateRoleDto } from './dto/rbac.dto';

describe('RbacController', () => {
  let rbacController: RbacController;
  let roleController: RoleController;
  let service: RbacService;

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

  const roleRow = {
    id: 'r1',
    name: 'editor',
    permissions: '[{"resource":"doc","action":"read"}]',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RbacController, RoleController],
      providers: [
        RbacService,
        JwtAuthGuard,
        { provide: ConfigService, useValue: mockConfig },
        { provide: DatabaseService, useValue: mockDb },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    rbacController = module.get(RbacController);
    roleController = module.get(RoleController);
    service = module.get(RbacService);
  });

  describe('listRoles', () => {
    it('should list roles', async () => {
      mockDb.query.mockResolvedValue({ rows: [roleRow] });
      const result = await roleController.list();
      expect(result).toEqual([roleRow]);
    });
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const dto: CreateRoleDto = { name: 'editor', permissions: [{ resource: 'doc', action: 'read' }] };
      mockDb.query.mockResolvedValue({ rows: [roleRow] });
      const result = await roleController.create(dto);
      expect(result.id).toBe('r1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO rbac_roles'),
        expect.arrayContaining(['editor', expect.any(String)]),
      );
    });
  });

  describe('deleteRole', () => {
    it('should throw when role not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });
      await expect(roleController.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addPermission', () => {
    it('should add a permission', async () => {
      const dto: AddPermissionDto = { permission: { resource: 'doc', action: 'write' } };
      mockDb.query
        .mockResolvedValueOnce({ rows: [roleRow] })
        .mockResolvedValueOnce({ rows: [roleRow] });
      const result = await roleController.addPermission('r1', dto);
      expect(result.id).toBe('r1');
    });
  });

  describe('listRolePermissions', () => {
    it('should list permissions', async () => {
      mockDb.query.mockResolvedValue({ rows: [roleRow] });
      const result = await roleController.listPermissions('r1');
      expect(result).toEqual([{ resource: 'doc', action: 'read' }]);
    });
  });

  describe('checkPermission', () => {
    it('should grant when permission present', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ permissions: '[{"resource":"doc","action":"read"}]' }] });
      const dto: CheckPermissionDto = { userId: 'u1', resource: 'doc', action: 'read' };
      const result = await rbacController.check(dto);
      expect(result.granted).toBe(true);
    });

    it('should deny when permission absent', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ permissions: '[]' }] });
      const dto: CheckPermissionDto = { userId: 'u1', resource: 'doc', action: 'delete' };
      const result = await rbacController.check(dto);
      expect(result.granted).toBe(false);
    });
  });
});
