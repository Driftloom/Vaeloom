import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('should run in context and return values', () => {
    service.run({ correlationId: 'req-1', tenantId: 't-1', userId: 'u-1' }, () => {
      expect(service.correlationId).toBe('req-1');
      expect(service.tenantId).toBe('t-1');
      expect(service.userId).toBe('u-1');
      expect(service.getStore()).toEqual({
        correlationId: 'req-1',
        tenantId: 't-1',
        userId: 'u-1',
      });
    });
  });

  it('should return undefined if no context', () => {
    expect(service.correlationId).toBeUndefined();
    expect(service.tenantId).toBeUndefined();
    expect(service.userId).toBeUndefined();
    expect(service.getStore()).toBeUndefined();
  });

  it('should set principal', () => {
    service.run({ correlationId: 'req-1' }, () => {
      service.setPrincipal({ userId: 'u-1', tenantId: 't-1' });
      expect(service.userId).toBe('u-1');
      expect(service.tenantId).toBe('t-1');
    });
  });

  it('should not throw when setting principal without context', () => {
    expect(() => service.setPrincipal({ userId: 'u-1' })).not.toThrow();
  });
});
