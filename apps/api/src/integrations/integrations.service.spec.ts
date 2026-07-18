import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

describe('IntegrationsService', () => {
  let service: IntegrationsService;

  beforeEach(async () => {
    const prismaMock = {};
    const httpMock = {};
    const configMock = {
      get: jest.fn().mockReturnValue('http://mock:8400'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HttpService, useValue: httpMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should return mock creation result', async () => {
      const dto = { name: 'Google Drive', provider: 'drive', config: {} };
      const result = await service.create(dto, 'user-1', 'tenant-1');
      expect(result.name).toBe('Google Drive');
      expect(result.provider).toBe('drive');
      expect(result.userId).toBe('user-1');
      expect(result.tenantId).toBe('tenant-1');
    });
  });

  describe('findAll', () => {
    it('should return paginated mock data', async () => {
      const result = await service.findAll('tenant-1');
      expect(result.meta.total).toBe(2);
      expect(result.data.length).toBe(2);
      expect(result.data[0].tenantId).toBe('tenant-1');
    });
  });

  describe('findOne', () => {
    it('should return mock data by id', async () => {
      const result = await service.findOne('id-1', 'tenant-1');
      expect(result.id).toBe('id-1');
      expect(result.tenantId).toBe('tenant-1');
    });
  });

  describe('update', () => {
    it('should return updated mock data', async () => {
      const dto = { name: 'New Name' };
      const result = await service.update('id-1', dto, 'tenant-1');
      expect(result.id).toBe('id-1');
      expect(result.name).toBe('New Name');
    });
  });

  describe('remove', () => {
    it('should resolve without errors', async () => {
      await expect(service.remove('id-1', 'tenant-1')).resolves.toBeUndefined();
    });
  });

  describe('sync', () => {
    it('should resolve sync result', async () => {
      const result = await service.sync('id-1', 'tenant-1');
      expect(result).toEqual({ synced: true, message: 'Sync completed' });
    });
  });
});
