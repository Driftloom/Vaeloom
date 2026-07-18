import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PaginatedResponse } from '@vaeloom/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { IntegrationsService } from './integrations.service';
import type { Integration } from '../generated/prisma';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateIntegrationDto): Promise<Integration> {
    return this.integrations.create(dto as unknown as Record<string, unknown>, user.id, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all integrations' })
  findAll(@CurrentUser() user: AuthedUser): Promise<PaginatedResponse<Integration>> {
    return this.integrations.findAll(user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an integration' })
  update(@CurrentUser() user: AuthedUser, @Param('id') id: string, @Body() dto: CreateIntegrationDto): Promise<Integration> {
    return this.integrations.update(id, dto as unknown as Record<string, unknown>, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an integration' })
  remove(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<void> {
    return this.integrations.remove(id, user.id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger a sync for an integration' })
  sync(@CurrentUser() user: AuthedUser, @Param('id') id: string) {
    return this.integrations.sync(id, user.id);
  }
}
