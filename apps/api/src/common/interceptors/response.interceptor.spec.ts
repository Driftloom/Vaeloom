import { Test, TestingModule } from '@nestjs/testing';
import { ResponseInterceptor } from './response.interceptor';
import { RequestContextService } from '../../observability/request-context.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;
  let requestContextMock: any;
  let contextMock: ExecutionContext;
  let nextMock: CallHandler;

  beforeEach(async () => {
    requestContextMock = {
      correlationId: 'req-123',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseInterceptor,
        { provide: RequestContextService, useValue: requestContextMock },
      ],
    }).compile();

    interceptor = module.get<ResponseInterceptor<any>>(ResponseInterceptor);

    contextMock = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn(),
      }),
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should wrap non-paginated data in SuccessResponse', (done) => {
    nextMock = {
      handle: () => of({ myField: 'value' }),
    };

    interceptor.intercept(contextMock, nextMock).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ myField: 'value' });
      expect(result.meta).toBeDefined();
      expect(result.meta?.requestId).toBe('req-123');
      expect(result.meta?.total).toBe(0);
      done();
    });
  });

  it('should preserve paginated data structure but append requestId and timestamp', (done) => {
    const existingMeta = {
      total: 100,
      page: 1,
      pageSize: 10,
      hasNext: true,
      timestamp: 'old',
      requestId: 'old',
    };
    
    nextMock = {
      handle: () => of({
        data: [{ item: 1 }],
        meta: existingMeta,
      }),
    };

    interceptor.intercept(contextMock, nextMock).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ item: 1 }]);
      expect(result.meta).toBeDefined();
      expect(result.meta?.total).toBe(100);
      expect(result.meta?.hasNext).toBe(true);
      expect(result.meta?.requestId).toBe('req-123'); // overrides old
      expect(result.meta?.timestamp).not.toBe('old'); // overrides old
      done();
    });
  });

  it('should wrap falsy data', (done) => {
    nextMock = {
      handle: () => of(null),
    };

    interceptor.intercept(contextMock, nextMock).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      done();
    });
  });
});
