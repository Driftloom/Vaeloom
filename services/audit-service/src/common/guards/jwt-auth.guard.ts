import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const jwt = this.verifyToken(token);
      request.user = { id: jwt.sub, email: jwt.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private verifyToken(token: string): { sub: string; email: string } {
    const secret = this.config.get<string>('auth.secret') as string;
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const payload = JSON.parse(Buffer.from(parts[1] as string, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired');

    const base64url = (str: string): string => str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expectedSig = base64url(createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url'));
    if (parts[2] !== expectedSig) throw new Error('Token signature mismatch');

    return { sub: payload.sub, email: payload.email };
  }
}
