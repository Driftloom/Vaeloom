import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import 'multer';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string): Promise<any[]> {
    this.logger.debug(`Fetching documents for workspace ${workspaceId}`);
    return this.prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
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
