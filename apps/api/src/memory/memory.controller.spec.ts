import { Test, TestingModule } from '@nestjs/testing';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

describe('MemoryController', () => {
  let controller: MemoryController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      search: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [
        { provide: MemoryService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const mockUser = { id: 'u-1', email: 'u@test.com' };

  describe('create', () => {
    it('should call create on service', async () => {
      serviceMock.create.mockResolvedValue({ id: 'mem-1' });
      const result = await controller.create(mockUser, { text: 'test' } as any);
      expect(result.id).toBe('mem-1');
      expect(serviceMock.create).toHaveBeenCalledWith({ text: 'test' }, 'u-1');
    });
  });

  describe('findAll', () => {
    it('should call findAll on service', async () => {
      serviceMock.findAll.mockResolvedValue({ data: [] });
      const result = await controller.findAll(mockUser, '1', '10');
      expect(result.data).toEqual([]);
      expect(serviceMock.findAll).toHaveBeenCalledWith('u-1', { page: '1', pageSize: '10' });
    });
  });

  describe('findOne', () => {
    it('should call findOne on service', async () => {
      serviceMock.findOne.mockResolvedValue({ id: 'mem-1' });
      const result = await controller.findOne(mockUser, 'mem-1');
      expect(result.id).toBe('mem-1');
      expect(serviceMock.findOne).toHaveBeenCalledWith('mem-1', 'u-1');
    });
  });

  describe('update', () => {
    it('should call update on service', async () => {
      serviceMock.update.mockResolvedValue({ id: 'mem-1' });
      const result = await controller.update(mockUser, 'mem-1', { text: 'test' } as any);
      expect(result.id).toBe('mem-1');
      expect(serviceMock.update).toHaveBeenCalledWith('mem-1', { text: 'test' }, 'u-1');
    });
  });

  describe('remove', () => {
    it('should call remove on service', async () => {
      serviceMock.remove.mockResolvedValue(undefined);
      await controller.remove(mockUser, 'mem-1');
      expect(serviceMock.remove).toHaveBeenCalledWith('mem-1', 'u-1');
    });
  });

  describe('search', () => {
    it('should call search on service', async () => {
      serviceMock.search.mockResolvedValue({ data: [] });
      const result = await controller.search(mockUser, { query: 'test', limit: 5 } as any);
      expect(result.data).toEqual([]);
      expect(serviceMock.search).toHaveBeenCalledWith('test', 'u-1', { limit: 5, offset: undefined, tags: undefined, types: undefined });
    });
  });
});
