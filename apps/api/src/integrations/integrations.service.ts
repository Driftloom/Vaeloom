import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResponse } from '@vaeloom/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { Integration } from '../generated/prisma';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, timeout, catchError } from 'rxjs';

@Injectable()
export class IntegrationsService {
  private readonly connectorUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.connectorUrl = this.config.get<string>('connectorServiceUrl') ?? 'http://localhost:8400';
  }

  async create(dto: Record<string, unknown>, userId: string, tenantId: string) {
    return {
      id: `mock-${Date.now()}`,
      name: dto['name'] as string,
      provider: dto['provider'] as string,
      config: dto['config'] as any,
      userId,
      tenantId,
      status: 'connected',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: null,
    };
  }

  async findAll(tenantId: string): Promise<PaginatedResponse<Integration>> {
    const data = [
      { id: 'c1', provider: 'drive', status: 'connected', name: 'Google Drive', tenantId, userId: tenantId },
      { id: 'c2', provider: 'gmail', status: 'connected', name: 'Gmail', tenantId, userId: tenantId }
    ];
    return { data: data as unknown as Integration[], meta: { page: 1, pageSize: 2, total: 2, totalPages: 1, hasNext: false, hasPrevious: false } };
  }

  async findOne(id: string, tenantId: string): Promise<Integration> {
    return { id, provider: 'mock', status: 'connected', name: 'Mock', tenantId, userId: tenantId } as unknown as Integration;
  }

  async update(id: string, dto: Record<string, unknown>, tenantId: string): Promise<Integration> {
    return { id, name: dto['name'] as string } as unknown as Integration;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    return;
  }

  async sync(id: string, tenantId: string): Promise<{ synced: boolean; message: string }> {
    return { synced: true, message: 'Sync completed' };
  }
}
