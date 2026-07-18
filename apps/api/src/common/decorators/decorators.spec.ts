import { Public, IS_PUBLIC_KEY } from './public.decorator';
import { Roles, ROLES_KEY } from './roles.decorator';
import { Tenant } from './tenant.decorator';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

function getParamDecoratorFactory(decorator: Function) {
  class Test {
    public test(@decorator() value: any) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('Decorators', () => {
  it('Public should set isPublic metadata', () => {
    class Test {
      @Public()
      method() {}
    }
    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, Test.prototype.method);
    expect(metadata).toBe(true);
  });

  it('Roles should set roles metadata', () => {
    class Test {
      @Roles('admin', 'user')
      method() {}
    }
    const metadata = Reflect.getMetadata(ROLES_KEY, Test.prototype.method);
    expect(metadata).toEqual(['admin', 'user']);
  });

  describe('Tenant', () => {
    const factory = getParamDecoratorFactory(Tenant);

    it('should extract tenantId from user', () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { tenantId: 't-1' } }),
        }),
      } as unknown as ExecutionContext;

      expect(factory(null, ctx)).toBe('t-1');
    });

    it('should extract tenantId from headers if user not set', () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-tenant-id': 't-2' } }),
        }),
      } as unknown as ExecutionContext;

      expect(factory(null, ctx)).toBe('t-2');
    });
  });
});
