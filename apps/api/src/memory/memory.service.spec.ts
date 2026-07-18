import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { of } from 'rxjs';

describe('MemoryService', () => {
  let service: MemoryService;
  let httpMock: any;
  let cacheMock: any;

  beforeEach(async () => {
    httpMock = {
      request: jest.fn(),
    };
    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const configMock = {
      get: jest.fn().mockReturnValue('http://mock:8100'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: HttpService, useValue: httpMock },
        { provide: ConfigService, useValue: configMock },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should post memory', async () => {
      httpMock.request.mockReturnValue(of({ data: { id: 'mem-1' } }));
      const result = await service.create({ content: 'test' }, 't-1');
      expect(result.id).toBe('mem-1');
    });
  });

  describe('findAll', () => {
    it('should get memories', async () => {
      httpMock.request.mockReturnValue(of({ data: { data: [{ id: 'mem-1' }] } }));
      const result = await service.findAll('t-1', { page: 1 });
      expect(result.data[0].id).toBe('mem-1');
    });
  });

  describe('findOne', () => {
    it('should return cached memory if exists', async () => {
      cacheMock.get.mockResolvedValue({ id: 'mem-1' });
      const result = await service.findOne('mem-1', 't-1');
      expect(result.id).toBe('mem-1');
      expect(httpMock.request).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not in cache', async () => {
      cacheMock.get.mockResolvedValue(null);
      httpMock.request.mockReturnValue(of({ data: { id: 'mem-1' } }));
      
      const result = await service.findOne('mem-1', 't-1');
      expect(result.id).toBe('mem-1');
      expect(cacheMock.set).toHaveBeenCalledWith('memory:mem-1', { id: 'mem-1' }, 60);
    });
  });

  describe('update', () => {
    it('should put memory and del cache', async () => {
      httpMock.request.mockReturnValue(of({ data: { id: 'mem-1' } }));
      const result = await service.update('mem-1', { content: 'test' }, 't-1');
      expect(result.id).toBe('mem-1');
      expect(cacheMock.del).toHaveBeenCalledWith('memory:mem-1');
    });
  });

  describe('remove', () => {
    it('should delete memory and del cache', async () => {
      httpMock.request.mockReturnValue(of({ data: null }));
      await service.remove('mem-1', 't-1');
      expect(cacheMock.del).toHaveBeenCalledWith('memory:mem-1');
    });
  });

  describe('search', () => {
    it('should post search query', async () => {
      httpMock.request.mockReturnValue(of({ data: { data: [{ id: 'mem-1' }] } }));
      const result = await service.search('query', 't-1', { limit: 10 });
      expect(result.data[0].id).toBe('mem-1');
    });
  });
});
