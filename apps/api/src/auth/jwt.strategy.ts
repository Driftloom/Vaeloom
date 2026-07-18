import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { JwtPayload } from '@vaeloom/shared-types';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service';

/** Authenticated principal attached to `request.user` after a valid Bearer token. */
export interface AuthedUser {
  id: string;
  email: string;
}

/**
 * Validates the Bearer JWT on protected routes. The payload's `sub` must still
 * resolve to a live user row — a token for a deleted user is rejected.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.secret') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Token subject no longer exists');
    }
    return { id: user.id, email: user.email };
  }
}
