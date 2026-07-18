import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workspaces/:workspaceId/documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all documents in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async list(@Param('workspaceId') workspaceId: string): Promise<any[]> {
    return this.docs.findAll(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a new document to the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: any,
  ): Promise<{ jobId: string }> {
    return this.docs.enqueueUpload(workspaceId, file);
  }
}
