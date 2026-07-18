import { createHash } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';

export interface DocumentRow {
  id: string;
  type: string;
  status: string;
  title: string;
  content: string | null;
  content_hash: string;
  size: number;
  metadata: string;
  tenant_id: string;
  workspace_id: string | null;
  source_type: string | null;
  source_uri: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  created_at: Date;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
  ) {}

  async ingest(dto: IngestDocumentDto): Promise<DocumentRow & { chunkCount: number }> {
    const tenantId = dto.tenantId ?? this.requestContext.tenantId ?? 'default';
    const userId = this.requestContext.userId ?? null;

    const content = await this.resolveContent(dto);
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Document has no content to ingest');
    }

    const contentHash = createHash('sha256').update(content).digest('hex');
    const size = Buffer.byteLength(content, 'utf-8');

    const inserted = await this.db.query<DocumentRow>(
      `INSERT INTO memories (
        type, status, title, content, content_hash, size, metadata,
        tenant_id, user_id, workspace_id, source_type, source_uri
      ) VALUES ('document', 'PROCESSING', $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        dto.title,
        content,
        contentHash,
        size,
        JSON.stringify({ connectorId: dto.connectorId ?? null }),
        tenantId,
        userId,
        dto.workspaceId ?? null,
        dto.sourceType,
        dto.url ?? null,
      ],
    );

    const document = inserted.rows[0]!;
    this.metrics.recordEvent('document.ingest.started');

    try {
      const chunkCount = await this.processChunks(document.id, content);

      await this.db.query(
        `UPDATE memories SET status = 'INDEXED', updated_at = NOW() WHERE id = $1`,
        [document.id],
      );

      this.metrics.recordEvent('document.ingest.indexed');
      this.logger.log({ documentId: document.id, chunkCount }, 'Document ingested');

      return { ...document, status: 'INDEXED', chunkCount };
    } catch (err) {
      await this.db.query(
        `UPDATE memories SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [document.id],
      );
      this.metrics.recordEvent('document.ingest.failed');
      this.logger.error({ documentId: document.id, err }, 'Document ingestion failed');
      throw err;
    }
  }

  async findAll(query: QueryDocumentDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const tenantId = this.requestContext.tenantId ?? 'default';

    const conditions: string[] = ["type = 'document'", 'tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (query.status) {
      conditions.push(`status = $${idx}`);
      params.push(query.status);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM memories WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<DocumentRow>(
      `SELECT * FROM memories WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dataResult.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async findById(id: string): Promise<DocumentRow & { chunks: DocumentChunkRow[] }> {
    const document = await this.getDocument(id);
    const chunks = await this.getChunks(id);
    return { ...document, chunks };
  }

  async getChunks(id: string): Promise<DocumentChunkRow[]> {
    const result = await this.db.query<DocumentChunkRow>(
      `SELECT id, document_id, content, chunk_index, created_at
       FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index ASC`,
      [id],
    );
    return result.rows;
  }

  async reprocess(id: string): Promise<DocumentRow & { chunkCount: number }> {
    const document = await this.getDocument(id);
    const content = document.content ?? '';
    if (content.trim().length === 0) {
      throw new BadRequestException('Document has no stored content to reprocess');
    }

    await this.db.query(
      `UPDATE memories SET status = 'PROCESSING', updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await this.db.query(`DELETE FROM document_chunks WHERE document_id = $1`, [id]);

    try {
      const chunkCount = await this.processChunks(id, content);
      await this.db.query(
        `UPDATE memories SET status = 'INDEXED', updated_at = NOW() WHERE id = $1`,
        [id],
      );
      this.metrics.recordEvent('document.reprocessed');
      this.logger.log({ documentId: id, chunkCount }, 'Document reprocessed');
      return { ...document, status: 'INDEXED', chunkCount };
    } catch (err) {
      await this.db.query(
        `UPDATE memories SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [id],
      );
      throw err;
    }
  }

  private async getDocument(id: string): Promise<DocumentRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const result = await this.db.query<DocumentRow>(
      `SELECT * FROM memories WHERE id = $1 AND tenant_id = $2 AND type = 'document'`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Document with id "${id}" not found`);
    }
    return result.rows[0]!;
  }

  private async processChunks(documentId: string, content: string): Promise<number> {
    const chunks = this.chunkText(content);

    let index = 0;
    for (const chunk of chunks) {
      const embedding = await this.computeEmbedding(chunk);
      await this.db.query(
        `INSERT INTO document_chunks (document_id, content, chunk_index, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [documentId, chunk, index, `[${embedding.join(',')}]`],
      );
      index++;
    }

    return chunks.length;
  }

  chunkText(text: string): string[] {
    const size = this.config.get<number>('chunking.size') ?? 1000;
    const overlap = this.config.get<number>('chunking.overlap') ?? 200;

    const normalized = text.trim();
    if (normalized.length === 0) return [];
    if (normalized.length <= size) return [normalized];

    const step = Math.max(1, size - overlap);
    const chunks: string[] = [];

    for (let start = 0; start < normalized.length; start += step) {
      const end = Math.min(start + size, normalized.length);
      chunks.push(normalized.slice(start, end));
      if (end >= normalized.length) break;
    }

    return chunks;
  }

  private async resolveContent(dto: IngestDocumentDto): Promise<string> {
    if (dto.content && dto.content.trim().length > 0) {
      return dto.content;
    }
    if (dto.url) {
      try {
        const response = await firstValueFrom(
          this.http.get<string>(dto.url, { responseType: 'text', timeout: 20000 }),
        );
        return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      } catch (err) {
        this.logger.warn({ url: dto.url, err }, 'Failed to fetch document from url');
        throw new BadRequestException(`Unable to fetch content from url: ${dto.url}`);
      }
    }
    throw new BadRequestException('Either content or url must be provided');
  }

  private async computeEmbedding(text: string): Promise<number[]> {
    const dimension = this.config.get<number>('ai.embeddingDimension') ?? 1536;
    if (!text || text.trim().length === 0) {
      return new Array(dimension).fill(0);
    }

    const aiUrl = this.config.get<string>('ai.serviceUrl') as string;
    const endpoint = this.config.get<string>('ai.embeddingEndpoint') as string;

    try {
      const response = await firstValueFrom(
        this.http.post<{ embedding?: number[]; data?: { embedding: number[] }[] }>(
          `${aiUrl}${endpoint}`,
          { text: text.slice(0, 8192) },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const body = response.data;
      const embedding = body.data ? body.data[0]?.embedding : body.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from AI service');
      }

      return embedding;
    } catch (err) {
      this.logger.warn({ err }, 'Embedding computation failed, using zero vector');
      return new Array(dimension).fill(0);
    }
  }
}
