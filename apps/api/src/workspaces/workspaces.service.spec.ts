import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      workspace: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a workspace with default name if name is undefined', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        userId: 'user-1',
        name: 'My Workspace',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };
      prismaMock.workspace.create.mockResolvedValue(mockWorkspace);

      const result = await service.create('user-1');

      expect(prismaMock.workspace.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'My Workspace' },
      });
      expect(result).toEqual({
        ...mockWorkspace,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('should create a workspace with provided name', async () => {
      const mockWorkspace = {
        id: 'ws-1',
        userId: 'user-1',
        name: 'Custom',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.workspace.create.mockResolvedValue(mockWorkspace);

      await service.create('user-1', '  Custom  ');

      expect(prismaMock.workspace.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: 'Custom' },
      });
    });
  });

  describe('listForUser', () => {
    it('should list workspaces for a user', async () => {
      const mockDate = new Date('2026-01-01T00:00:00Z');
      const mockWorkspaces = [
        { id: 'ws-1', userId: 'user-1', name: 'W1', createdAt: mockDate, updatedAt: mockDate },
      ];
      prismaMock.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.listForUser('user-1');

      expect(prismaMock.workspace.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result[0].id).toBe('ws-1');
      expect(result[0].createdAt).toBe(mockDate.toISOString());
    });
  });

  describe('findById', () => {
    it('should return a workspace by id', async () => {
      const mockDate = new Date('2026-01-01T00:00:00Z');
      prismaMock.workspace.findFirst.mockResolvedValue({
        id: 'ws-1', userId: 'user-1', name: 'W1', createdAt: mockDate, updatedAt: mockDate
      });

      const result = await service.findById('ws-1', 'user-1');

      expect(prismaMock.workspace.findFirst).toHaveBeenCalledWith({
        where: { id: 'ws-1', userId: 'user-1' },
      });
      expect(result?.id).toBe('ws-1');
    });

    it('should return null if workspace not found', async () => {
      prismaMock.workspace.findFirst.mockResolvedValue(null);
      const result = await service.findById('ws-1', 'user-1');
      expect(result).toBeNull();
    });
  });
});
