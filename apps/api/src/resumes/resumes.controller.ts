import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ResumesService } from './resumes.service';

@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workspaces/:workspaceId/resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  @ApiOperation({ summary: 'List all resumes for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async list(@Param('workspaceId') workspaceId: string): Promise<any[]> {
    return this.resumes.findAll(workspaceId);
  }

  @Get('master')
  @ApiOperation({ summary: 'Get the master resume for the workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async getMaster(@Param('workspaceId') workspaceId: string): Promise<any> {
    return this.resumes.getMasterResume(workspaceId);
  }

  @Post(':resumeId/generate')
  @ApiOperation({ summary: 'Generate a resume variant' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'resumeId', description: 'Resume ID to base the variant on' })
  async generateVariant(
    @Param('workspaceId') workspaceId: string,
    @Param('resumeId') resumeId: string,
    @Body() parameters: any,
  ): Promise<any> {
    return this.resumes.generateVariant(workspaceId, resumeId, parameters);
  }
}
