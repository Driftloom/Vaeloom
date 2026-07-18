import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  tenantId?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = this.verify(token);

    const tenantId = payload.tenantId ?? 'default';
    (request as Request & { user: JwtPayload }).user = payload;
    (request as Request & { tenantId: string }).tenantId = tenantId;

    return true;
  }

  private base64UrlDecode(input: string): Buffer {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64');
  }

  private verify(token: string): JwtPayload {
    const secret = this.config.get<string>('auth.secret');
    if (!secret) {
      throw new UnauthorizedException('Auth secret not configured');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expected = createHmac('sha256', secret).update(data).digest('base64url');

    const sig = Buffer.from(signatureB64 ?? '', 'base64url');
    const exp = Buffer.from(expected, 'base64url');

    if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: JwtPayload;
    try {
      payload = JSON.parse(this.base64UrlDecode(payloadB64 ?? '').toString('utf8')) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }

    return payload;
  }
}
