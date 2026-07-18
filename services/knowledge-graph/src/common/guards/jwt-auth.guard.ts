import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '@vaeloom/shared-types';
import { verify } from 'jsonwebtoken';

import type { AuthedUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly config: ConfigService) {}

  validateToken(token: string): AuthedUser {
    const secret = this.config.get<string>('auth.secret');
    if (!secret) throw new UnauthorizedException('Auth secret not configured');
    try {
      const payload = verify(token.replace('Bearer ', ''), secret) as JwtPayload;
      return { id: payload.sub, email: payload.email ?? '' };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
