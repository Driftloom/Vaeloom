import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManagerMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return a value from cache', async () => {
      cacheManagerMock.get.mockResolvedValue('value');
      const result = await service.get('key');
      expect(result).toEqual('value');
      expect(cacheManagerMock.get).toHaveBeenCalledWith('key');
    });
  });

  describe('set', () => {
    it('should set a value with default ttl from config', async () => {
      configServiceMock.get.mockReturnValue(500);
      await service.set('key', 'value');
      expect(cacheManagerMock.set).toHaveBeenCalledWith('key', 'value', 500);
    });

    it('should set a value with fallback ttl if config is missing', async () => {
      configServiceMock.get.mockReturnValue(undefined);
      await service.set('key', 'value');
      expect(cacheManagerMock.set).toHaveBeenCalledWith('key', 'value', 300);
    });

    it('should set a value with provided ttl', async () => {
      await service.set('key', 'value', 100);
      expect(cacheManagerMock.set).toHaveBeenCalledWith('key', 'value', 100);
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await service.del('key');
      expect(cacheManagerMock.del).toHaveBeenCalledWith('key');
    });
  });

  describe('invalidate', () => {
    it('should delete multiple keys matching pattern if store.keys is a function', async () => {
      cacheManagerMock.keys.mockResolvedValue(['key1', 'key2']);
      await service.invalidate('pattern');
      expect(cacheManagerMock.keys).toHaveBeenCalledWith('pattern');
      expect(cacheManagerMock.del).toHaveBeenCalledWith('key1');
      expect(cacheManagerMock.del).toHaveBeenCalledWith('key2');
    });

    it('should do nothing if store.keys is not a function', async () => {
      cacheManagerMock.keys = undefined; // mock absence of method
      await service.invalidate('pattern');
      expect(cacheManagerMock.del).not.toHaveBeenCalled();
    });
  });
});
