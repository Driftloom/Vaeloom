import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import 'multer';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, params?: { page?: number; pageSize?: number }): Promise<any[]> {
    this.logger.debug(`Fetching documents for workspace ${workspaceId}`);
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    return this.prisma.document.findMany({
      where: { workspaceId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: { id: true, path: true, type: true, summary: true, metadata: true, createdAt: true, updatedAt: true, workspaceId: true, sourceConnectorId: true },
    });
  }

  async enqueueUpload(workspaceId: string, file: any): Promise<{ jobId: string }> {
    // In MVP, we might save the document record as "uploading" or "queued"
    // and push to BullMQ or pass it to ai-service ingestion pipeline.
    this.logger.log(`Received file ${file.originalname} for workspace ${workspaceId}`);
    
    // Stub implementation for now
    const doc = await this.prisma.document.create({
      data: {
        workspaceId,
        path: file.originalname,
        rawStorageKey: `storage://uploads/${workspaceId}/${file.originalname}`,
        type: file.mimetype,
      },
    });

    return { jobId: `job-${doc.id}` };
  }
}
