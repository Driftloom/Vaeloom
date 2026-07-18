import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import type { AuthedUser } from '../auth/jwt.strategy';
import type { Integration } from '../generated/prisma';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  let service: IntegrationsService;

  const mockUser: AuthedUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
    tenantId: 'tenant-123'
  };

  const mockIntegration = {
    id: 'c1',
    name: 'Google Drive',
    provider: 'drive',
    config: {},
    userId: mockUser.id,
    tenantId: mockUser.tenantId,
    status: 'connected',
    lastSyncAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  } as unknown as Integration;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            sync: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
    service = module.get<IntegrationsService>(IntegrationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an integration', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockIntegration);
      const dto = { name: 'Google Drive', provider: 'drive' };
      const result = await controller.create(mockUser, dto);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser.id, mockUser.id);
      expect(result).toEqual(mockIntegration);
    });
  });

  describe('findAll', () => {
    it('should return paginated integrations', async () => {
      const mockPaginated = {
        data: [mockIntegration],
        meta: { page: 1, pageSize: 1, total: 1, totalPages: 1, hasNext: false, hasPrevious: false }
      };
      jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginated);
      const result = await controller.findAll(mockUser);
      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockPaginated);
    });
  });

  describe('update', () => {
    it('should update an integration', async () => {
      jest.spyOn(service, 'update').mockResolvedValue(mockIntegration);
      const dto = { name: 'Updated Drive' };
      const result = await controller.update(mockUser, 'c1', dto as any);
      expect(service.update).toHaveBeenCalledWith('c1', dto, mockUser.id);
      expect(result).toEqual(mockIntegration);
    });
  });

  describe('remove', () => {
    it('should delete an integration', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);
      await controller.remove(mockUser, 'c1');
      expect(service.remove).toHaveBeenCalledWith('c1', mockUser.id);
    });
  });

  describe('sync', () => {
    it('should trigger sync for an integration', async () => {
      const mockSync = { synced: true, message: 'Sync completed' };
      jest.spyOn(service, 'sync').mockResolvedValue(mockSync);
      const result = await controller.sync(mockUser, 'c1');
      expect(service.sync).toHaveBeenCalledWith('c1', mockUser.id);
      expect(result).toEqual(mockSync);
    });
  });
});
