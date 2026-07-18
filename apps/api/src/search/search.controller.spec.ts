import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      searchAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchUnified', () => {
    it('should call searchAll on service', async () => {
      serviceMock.searchAll.mockResolvedValue({ results: [], total: 0 });
      const mockUser = { id: 'u-1', email: 'test@t.com' };
      const result = await controller.searchUnified(mockUser, { query: 'q', limit: 10 } as any);
      expect(result).toEqual({ results: [], total: 0 });
      expect(serviceMock.searchAll).toHaveBeenCalledWith('q', 'u-1', undefined, 10);
    });
  });
});
