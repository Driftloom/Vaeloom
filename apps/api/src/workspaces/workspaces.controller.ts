import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import type { Workspace } from '@vaeloom/shared-types';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedUser } from '../auth/jwt.strategy';
import { PermissionGuard } from '../common/guards/permission.guard';

import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a new, empty workspace for the authenticated user' })
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateWorkspaceDto): Promise<Workspace> {
    return this.workspaces.create(user.id, dto.name);
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces owned by the authenticated user' })
  list(@CurrentUser() user: AuthedUser): Promise<Workspace[]> {
    return this.workspaces.listForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workspace by ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  async getWorkspace(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<Workspace> {
    const workspace = await this.workspaces.findById(id, user.id);
    if (!workspace) {
      throw new NotFoundException(`Workspace with id ${id} not found`);
    }
    return workspace;
  }

  @Get(':id/agents')
  @ApiOperation({ summary: 'List agents for a workspace (Mocked for Phase 7)' })
  async getWorkspaceAgents(@Param('id') id: string) {
    return [
      { id: '1', name: 'Organization Agent', category: 'organization', status: 'active' },
      { id: '2', name: 'Resume Agent', category: 'career', status: 'active' }
    ];
  }

  @Get(':id/memories')
  @ApiOperation({ summary: 'List memories for a workspace (Mocked for Phase 7)' })
  async getWorkspaceMemories(@Param('id') id: string) {
    return [
      { id: 'm1', title: 'Work Experience 2023', type: 'experience' },
      { id: 'm2', title: 'React Skill', type: 'skill' }
    ];
  }

  @Get(':id/connectors')
  @ApiOperation({ summary: 'List connectors for a workspace (Mocked for Phase 7)' })
  async getWorkspaceConnectors(@Param('id') id: string) {
    return [
      { id: 'c1', provider: 'drive', status: 'connected', lastSyncAt: new Date().toISOString() },
      { id: 'c2', provider: 'gmail', status: 'connected', lastSyncAt: new Date().toISOString() }
    ];
  }
}
