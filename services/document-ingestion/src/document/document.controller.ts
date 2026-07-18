import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import {
  DocumentService,
  type DocumentChunkRow,
  type DocumentRow,
} from './document.service';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { DocumentResponse } from './entities/document.entity';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest a document: chunk, embed and index' })
  @ApiBody({ type: IngestDocumentDto })
  @ApiResponse({ status: 201, type: DocumentResponse })
  async ingest(@Body() dto: IngestDocumentDto): Promise<DocumentRow & { chunkCount: number }> {
    return this.documentService.ingest(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List documents with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query() query: QueryDocumentDto,
  ): Promise<{ data: DocumentRow[]; meta: Record<string, unknown> }> {
    return this.documentService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document with its chunks' })
  @ApiResponse({ status: 200, type: DocumentResponse })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findOne(@Param('id') id: string): Promise<DocumentRow & { chunks: DocumentChunkRow[] }> {
    return this.documentService.findById(id);
  }

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Re-chunk and re-embed a document' })
  async reprocess(@Param('id') id: string): Promise<DocumentRow & { chunkCount: number }> {
    return this.documentService.reprocess(id);
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: 'List chunks of a document' })
  async chunks(@Param('id') id: string): Promise<DocumentChunkRow[]> {
    return this.documentService.getChunks(id);
  }
}
