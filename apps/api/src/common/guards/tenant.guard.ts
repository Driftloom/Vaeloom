import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestContextService } from '../../observability/request-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userTenantId = user?.tenantId as string | undefined;
    const pathTenantId = request.params['tenantId'] as string | undefined;

    if (userTenantId) {
      this.requestContext.setPrincipal({ tenantId: userTenantId });
    }

    if (pathTenantId && userTenantId && pathTenantId !== userTenantId) {
      throw new ForbiddenException('Tenant ID mismatch');
    }

    return true;
  }
}
