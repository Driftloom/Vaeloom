import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload, PublicUser } from '@vaeloom/shared-types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresIn: number;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  status: string;
  createdAt: Date;
}

interface UserWithPassword extends UserRow {
  passwordHash: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string; expiresIn: number; user: PublicUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const bcryptRounds = this.config.get<number>('auth.bcryptRounds') ?? 12;
    const passwordHash = await bcrypt.hash(password, bcryptRounds);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: `${normalizedEmail.split('@')[0]}'s Organization`,
        slug: `${normalizedEmail.split('@')[0]}-${randomUUID().slice(0, 8)}`,
        status: 'ACTIVE',
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: displayName?.trim() || normalizedEmail.split('@')[0] || 'user',
        tenantId: tenant.id,
        status: 'ACTIVE',
      },
    });

    await this.prisma.workspace.create({
      data: {
        name: 'My Workspace',
        slug: `my-workspace-${randomUUID().slice(0, 8)}`,
        tenantId: tenant.id,
      },
    });

    await this.prisma.workspaceUser.create({
      data: {
        workspaceId: (await this.prisma.workspace.findFirst({ where: { tenantId: tenant.id } }))!.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    return this.issueTokenPair(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string; expiresIn: number; user: PublicUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    }) as UserWithPassword | null;

    const ok = user?.passwordHash != null && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokenPair(user);
  }

  async refresh(
    sessionId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string; expiresIn: number }> {
    const refreshHash = createHash('sha256').update(refreshToken).digest('hex');

    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
    if (!session || session.refreshToken !== refreshHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session is no longer active');
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, displayName: true, tenantId: true, status: true, createdAt: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is no longer active');
    }

    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { status: 'REVOKED' },
    });

    return this.issueTokenPair(user);
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { status: 'REVOKED' },
    });
  }

  async getProfile(userId: string): Promise<{ user: PublicUser; workspaces: { id: string; name: string; slug: string; role: string }[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaces: {
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user: AuthService.toPublicUser(user),
      workspaces: user.workspaces.map((wu) => ({
        id: wu.workspace.id,
        name: wu.workspace.name,
        slug: wu.workspace.slug,
        role: wu.role,
      })),
    };
  }

  async createApiKey(
    userId: string,
    name: string,
    permissions: string[] = [],
  ): Promise<{ id: string; name: string; key: string; keyPrefix: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const rawKey = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name,
        keyPrefix,
        keyHash,
        permissions,
        tenantId: user.tenantId,
        userId,
      },
    });

    return { id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix: apiKey.keyPrefix };
  }

  async listApiKeys(userId: string): Promise<{ id: string; name: string; keyPrefix: string; permissions: unknown; enabled: boolean; createdAt: Date }[]> {
    return this.prisma.apiKey.findMany({
      where: { userId, enabled: true },
      select: { id: true, name: true, keyPrefix: true, permissions: true, enabled: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(keyId: string): Promise<void> {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { enabled: false },
    });
  }

  async validateApiKey(key: string): Promise<{ valid: boolean; userId?: string; tenantId?: string }> {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey || !apiKey.enabled) {
      return { valid: false };
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false };
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return { valid: true, userId: apiKey.userId, tenantId: apiKey.tenantId };
  }

  private async issueTokenPair(user: { id: string; email: string; displayName: string; tenantId: string; createdAt: Date }): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    expiresIn: number;
    user: PublicUser;
  }> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const jwtExpiresIn = this.config.get<string>('auth.jwtExpiresIn') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('auth.refreshExpiresIn') ?? '7d';
    const jwtSecret = this.config.get<string>('auth.jwtSecret') as string;

    const accessToken = this.jwt.sign(payload, {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
    });

    const rawRefreshToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const refreshHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    const refreshTtlMs = this.parseDuration(refreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    const jwtTtlSeconds = this.parseDurationToSeconds(jwtExpiresIn);

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        provider: 'email',
        token: accessToken.slice(0, 64),
        refreshToken: refreshHash,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId: session.id,
      expiresIn: jwtTtlSeconds,
      user: AuthService.toPublicUser(user),
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] ?? 86400000);
  }

  private parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 60);
  }

  static toPublicUser(user: { id: string; email: string; displayName: string; createdAt: Date }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      authProvider: 'email',
      createdAt: user.createdAt.toISOString(),
    };
  }
}
