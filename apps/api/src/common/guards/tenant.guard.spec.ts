import { Test, TestingModule } from '@nestjs/testing';
import { TenantGuard } from './tenant.guard';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../../observability/request-context.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflectorMock: any;
  let requestContextMock: any;
  let contextMock: ExecutionContext;

  beforeEach(async () => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    };

    requestContextMock = {
      setPrincipal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: RequestContextService, useValue: requestContextMock },
      ],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);

    contextMock = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { tenantId: 'tenant-1' },
          params: { tenantId: 'tenant-1' },
        }),
      }),
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if route is public', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(contextMock);
    expect(result).toBe(true);
  });

  it('should set principal and allow access if tenant match', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);

    const result = guard.canActivate(contextMock);

    expect(requestContextMock.setPrincipal).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if path tenant does not match user tenant', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);

    const requestMismatch = { user: { tenantId: 'tenant-1' }, params: { tenantId: 'tenant-2' } };
    (contextMock.switchToHttp().getRequest as jest.Mock).mockReturnValue(requestMismatch);

    expect(() => guard.canActivate(contextMock)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextMock)).toThrow('Tenant ID mismatch');
  });

  it('should allow access if path tenant is absent', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);

    const requestNoPath = { user: { tenantId: 'tenant-1' }, params: {} };
    (contextMock.switchToHttp().getRequest as jest.Mock).mockReturnValue(requestNoPath);

    const result = guard.canActivate(contextMock);

    expect(requestContextMock.setPrincipal).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
    expect(result).toBe(true);
  });
});
