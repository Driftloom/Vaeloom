import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, JwtPayload, PublicUser } from '@vaeloom/shared-types';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const BCRYPT_ROUNDS = 12;

/**
 * Email/password auth scaffold (file 01). Passwords are bcrypt-hashed; the JWT is
 * the only credential returned to clients. Structured so an OAuth/SSO provider can
 * be added later (file 15) without changing this public interface.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly workspaces: WorkspacesService,
  ) {}

  /** Register a new user, provision their first workspace, and issue a token. */
  async signup(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: displayName?.trim() || normalizedEmail.split('@')[0] || 'user',
        authProvider: 'email',
      },
    });

    // Every new user starts with an empty, correctly-provisioned workspace.
    await this.workspaces.create(user.id, 'My Workspace');

    return this.issueToken(user);
  }

  /** Verify credentials and issue a token. Uniform error to avoid user enumeration. */
  async login(email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const ok =
      user?.passwordHash != null && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user);
  }

  private issueToken(user: {
    id: string;
    email: string;
    displayName: string;
    authProvider: string;
    createdAt: Date;
  }): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const expiresIn = this.config.get<number>('auth.tokenTtl') ?? 3600;
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('auth.secret'),
      expiresIn,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: AuthService.toPublicUser(user),
    };
  }

  static toPublicUser(user: {
    id: string;
    email: string;
    displayName: string;
    authProvider: string;
    createdAt: Date;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      authProvider: user.authProvider,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
