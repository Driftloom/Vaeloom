import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: any;

  beforeEach(async () => {
    httpMock = {
      post: jest.fn(),
    };

    const configMock = {
      get: jest.fn((key) => {
        if (key === 'memoryServiceUrl') return 'http://mem:8100';
        if (key === 'kgServiceUrl') return 'http://kg:8300';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: HttpService, useValue: httpMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchAll', () => {
    it('should search memory if no sources specified', async () => {
      httpMock.post.mockImplementation((url) => {
        if (url.includes('mem:8100')) {
          return of({ data: { results: [{ id: '1', score: 0.9 }] } });
        }
        if (url.includes('kg:8300')) {
          return of({ data: { results: [{ id: '2', score: 0.8 }] } });
        }
        return of({ data: { results: [] } });
      });

      const result = await service.searchAll('test', 't-1');
      expect(result.results.length).toBe(2);
      expect(result.results[0].id).toBe('1');
    });

    it('should handle errors from services gracefully', async () => {
      httpMock.post.mockImplementation((url) => {
        if (url.includes('mem:8100')) {
          return throwError(() => new Error('timeout'));
        }
        if (url.includes('kg:8300')) {
          return of({ data: { results: [{ id: '2', score: 0.8 }] } });
        }
        return of({ data: { results: [] } });
      });

      const result = await service.searchAll('test', 't-1');
      expect(result.results.length).toBe(1);
      expect(result.results[0].id).toBe('2');
    });
  });
});
