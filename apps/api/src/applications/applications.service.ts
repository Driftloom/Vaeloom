import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string): Promise<any[]> {
    return this.prisma.application.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, applicationId: string): Promise<any> {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, workspaceId },
    });
    if (!app) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }
    return app;
  }

  async create(workspaceId: string, data: any): Promise<any> {
    // Basic stub for MVP
    return this.prisma.application.create({
      data: {
        workspaceId,
        jobExternalId: data.jobExternalId || 'unknown',
        platform: data.platform || 'unknown',
        status: data.status || 'DRAFT',
      },
    });
  }

  async updateOutcome(workspaceId: string, applicationId: string, status: any): Promise<any> {
    const app = await this.findOne(workspaceId, applicationId);
    return this.prisma.application.update({
      where: { id: app.id },
      data: { status },
    });
  }
}
