import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, params?: { page?: number; pageSize?: number }): Promise<any[]> {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    return this.prisma.application.findMany({
      where: { workspaceId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, workspaceId: true, jobExternalId: true, platform: true, status: true, resumeVersionId: true, coverLetter: true, submittedAt: true, outcome: true, outcomeAt: true, metadata: true, createdAt: true, updatedAt: true },
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
