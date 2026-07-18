import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
    middleware = new RequestContextMiddleware(service);
  });

  it('should use incoming request id and tenant id', (done) => {
    const req = {
      headers: {
        'x-request-id': 'existing-req',
        'x-tenant-id': 'existing-tenant',
      },
    } as any;
    const setHeaderMock = jest.fn();
    const res = { setHeader: setHeaderMock } as any;

    middleware.use(req, res, () => {
      expect(setHeaderMock).toHaveBeenCalledWith('x-request-id', 'existing-req');
      expect(service.correlationId).toBe('existing-req');
      expect(service.tenantId).toBe('existing-tenant');
      done();
    });
  });

  it('should generate new request id if none provided', (done) => {
    const req = {
      headers: {},
    } as any;
    const setHeaderMock = jest.fn();
    const res = { setHeader: setHeaderMock } as any;

    middleware.use(req, res, () => {
      expect(setHeaderMock).toHaveBeenCalled();
      const uuid = setHeaderMock.mock.calls[0][1];
      expect(uuid).toBeDefined();
      expect(service.correlationId).toBe(uuid);
      expect(service.tenantId).toBeUndefined();
      done();
    });
  });

  it('should handle array headers', (done) => {
    const req = {
      headers: {
        'x-request-id': ['req-arr', 'other'],
        'x-tenant-id': ['ten-arr', 'other'],
      },
    } as any;
    const setHeaderMock = jest.fn();
    const res = { setHeader: setHeaderMock } as any;

    middleware.use(req, res, () => {
      expect(service.correlationId).toBe('req-arr');
      expect(service.tenantId).toBe('ten-arr');
      done();
    });
  });
});
