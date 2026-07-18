import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ApplicationsService } from './applications.service';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workspaces/:workspaceId/applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all applications for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async list(@Param('workspaceId') workspaceId: string): Promise<any[]> {
    return this.applications.findAll(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new application record' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: any,
  ): Promise<any> {
    return this.applications.create(workspaceId, dto);
  }

  @Get(':applicationId')
  @ApiOperation({ summary: 'Get a single application by ID' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'applicationId', description: 'Application ID' })
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('applicationId') applicationId: string,
  ): Promise<any> {
    return this.applications.findOne(workspaceId, applicationId);
  }

  @Patch(':applicationId/outcome')
  @ApiOperation({ summary: 'Update the outcome/status of an application' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'applicationId', description: 'Application ID' })
  async updateOutcome(
    @Param('workspaceId') workspaceId: string,
    @Param('applicationId') applicationId: string,
    @Body('status') status: string,
  ): Promise<any> {
    return this.applications.updateOutcome(workspaceId, applicationId, status);
  }
}
