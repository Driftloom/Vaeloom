import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthedUser } from './jwt.strategy';

/**
 * Injects the authenticated principal into a handler param:
 * `@CurrentUser() user: AuthedUser`. Only meaningful behind JwtAuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthedUser;
  },
);
