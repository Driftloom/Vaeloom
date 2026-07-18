import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthedUser {
  id: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthedUser | undefined;
  },
);
