import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('No authenticated user');

    const workspaceId = request.params['workspaceId'] ?? request.params['id'];
    if (!workspaceId) throw new ForbiddenException('No workspace context');

    const membership = await this.prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (!membership) throw new ForbiddenException('Not a member of this workspace');
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
