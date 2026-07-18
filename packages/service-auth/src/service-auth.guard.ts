import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyServiceToken } from './service-token';

export const SKIP_SERVICE_AUTH = 'skipServiceAuth';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SERVICE_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Missing service auth token');

    try {
      const secret = this.config.get<string>('serviceAuth.secret');
      if (!secret) throw new Error('SERVICE_AUTH_SECRET not configured');
      const payload = verifyServiceToken(token, secret);
      request.service = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException(err instanceof Error ? err.message : 'Invalid service token');
    }
  }

  private extractToken(request: { headers?: Record<string, string | string[]> }): string | null {
    const auth = request.headers?.['x-service-auth'];
    if (!auth) return null;
    return Array.isArray(auth) ? (auth[0] ?? null) : auth;
  }
}
