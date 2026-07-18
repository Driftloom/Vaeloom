import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { NotFoundException } from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
import type { AuthedUser } from '../auth/jwt.strategy';
import type { Workspace } from '@vaeloom/shared-types';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: WorkspacesService;

  const mockUser: AuthedUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
    tenantId: 'tenant-123'
  };

  const mockWorkspace: Workspace = {
    id: 'ws-123',
    name: 'Test Workspace',
    tenantId: 'tenant-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            create: jest.fn(),
            listForUser: jest.fn(),
            findById: jest.fn()
          }
        },
        {
          provide: PermissionsService,
          useValue: {
            checkPermission: jest.fn().mockResolvedValue(true)
          }
        }
      ]
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a workspace', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockWorkspace);
      const result = await controller.create(mockUser, { name: 'Test Workspace' });
      expect(service.create).toHaveBeenCalledWith(mockUser.id, 'Test Workspace');
      expect(result).toEqual(mockWorkspace);
    });
  });

  describe('list', () => {
    it('should return a list of workspaces', async () => {
      jest.spyOn(service, 'listForUser').mockResolvedValue([mockWorkspace]);
      const result = await controller.list(mockUser);
      expect(service.listForUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockWorkspace]);
    });
  });

  describe('getWorkspace', () => {
    it('should return a workspace by ID', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockWorkspace);
      const result = await controller.getWorkspace(mockUser, mockWorkspace.id);
      expect(service.findById).toHaveBeenCalledWith(mockWorkspace.id, mockUser.id);
      expect(result).toEqual(mockWorkspace);
    });

    it('should throw NotFoundException if workspace is not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);
      await expect(controller.getWorkspace(mockUser, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Mocked Endpoints for MVP Phase 7', () => {
    it('should return mocked agents', async () => {
      const result = await controller.getWorkspaceAgents('ws-123');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('category', 'organization');
    });

    it('should return mocked memories', async () => {
      const result = await controller.getWorkspaceMemories('ws-123');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('type', 'experience');
    });

    it('should return mocked connectors', async () => {
      const result = await controller.getWorkspaceConnectors('ws-123');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('provider', 'drive');
    });
  });
});
