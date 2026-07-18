import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService, PermissionCheckOptions } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      workspace: {
        findFirst: jest.fn(),
      },
      permission: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return false if userId is provided but workspace is not found', async () => {
      prismaMock.workspace.findFirst.mockResolvedValue(null);

      const options: PermissionCheckOptions = {
        workspaceId: 'ws-1',
        userId: 'user-1',
        actionType: 'read',
      };

      const result = await service.check(options);

      expect(result).toBe(false);
      expect(prismaMock.workspace.findFirst).toHaveBeenCalledWith({
        where: { id: 'ws-1', userId: 'user-1' },
      });
    });

    it('should return false if agentName is provided but no permission is found', async () => {
      prismaMock.workspace.findFirst.mockResolvedValue({ id: 'ws-1', userId: 'user-1' });
      prismaMock.permission.findFirst.mockResolvedValue(null);

      const options: PermissionCheckOptions = {
        workspaceId: 'ws-1',
        userId: 'user-1',
        agentName: 'agent-1',
        actionType: 'write',
      };

      const result = await service.check(options);

      expect(result).toBe(false);
      expect(prismaMock.permission.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: 'ws-1',
          agentName: 'agent-1',
          actionType: 'write',
          revokedAt: null,
        },
      });
    });

    it('should return true if user owns workspace and no agentName provided', async () => {
      prismaMock.workspace.findFirst.mockResolvedValue({ id: 'ws-1', userId: 'user-1' });

      const options: PermissionCheckOptions = {
        workspaceId: 'ws-1',
        userId: 'user-1',
        actionType: 'read',
      };

      const result = await service.check(options);

      expect(result).toBe(true);
    });

    it('should return true if agentName provided and permission exists', async () => {
      prismaMock.permission.findFirst.mockResolvedValue({ id: 'perm-1' });

      const options: PermissionCheckOptions = {
        workspaceId: 'ws-1',
        agentName: 'agent-1',
        actionType: 'read',
      };

      const result = await service.check(options);

      expect(result).toBe(true);
      expect(prismaMock.workspace.findFirst).not.toHaveBeenCalled(); // userId was not provided
    });
  });
});
