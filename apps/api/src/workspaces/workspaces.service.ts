import { Injectable } from '@nestjs/common';
import type { Workspace } from '@vaeloom/shared-types';

import type { Workspace as PrismaWorkspace } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Owns workspace lifecycle. At MVP a workspace is the tenant-isolation boundary
 * (Docs/Database/Schema.md) provisioned empty for a user at signup (file 01) and
 * creatable on demand via `POST /workspaces`.
 */
@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name?: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.create({
      data: { userId, name: name?.trim() || 'My Workspace' },
    });
    return this.toDto(workspace);
  }

  async listForUser(userId: string, params?: { page?: number; pageSize?: number }): Promise<Workspace[]> {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    const rows = await this.prisma.workspace.findMany({
      where: { userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, name: true, description: true, createdAt: true, updatedAt: true },
    });
    return rows.map((w: PrismaWorkspace) => this.toDto(w));
  }

  async findById(id: string, userId: string): Promise<Workspace | null> {
    const row = await this.prisma.workspace.findFirst({
      where: { id, userId },
    });
    return row ? this.toDto(row) : null;
  }

  private toDto(w: PrismaWorkspace): Workspace {
    return {
      id: w.id,
      userId: w.userId,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    };
  }
}
