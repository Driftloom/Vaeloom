import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InternalAiService } from '../common/services/internal-ai.service';

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: InternalAiService,
  ) {}

  async findAll(workspaceId: string, params?: { page?: number; pageSize?: number }): Promise<any[]> {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    return this.prisma.resume.findMany({
      where: { workspaceId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, workspaceId: true, variantType: true, version: true, generatedFromSnapshot: true, createdAt: true, updatedAt: true },
    });
  }

  async getMasterResume(workspaceId: string): Promise<any> {
    const resume = await this.prisma.resume.findFirst({
      where: { workspaceId, variantType: 'master' },
    });
    if (!resume) {
      throw new NotFoundException('Master resume not found');
    }
    return resume;
  }

  async generateVariant(workspaceId: string, resumeId: string, parameters: any): Promise<any> {
    this.logger.log(`Requesting resume generation variant for resume ${resumeId} in workspace ${workspaceId}`);
    return this.aiService.generateResumeVariant(workspaceId, resumeId, parameters);
  }
}
