import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
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
import type { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import {
  ConnectIntegrationDto,
  IntegrationProvider,
} from './dto/connect-integration.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { QueryIntegrationDto } from './dto/query-integration.dto';
import { IntegrationResponse } from './entities/integration.entity';
import { IntegrationService, type IntegrationRow } from './integration.service';

@ApiTags('Integrations')
@UseInterceptors(ResponseInterceptor)
@Controller('integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Connect a third-party integration' })
  @ApiBody({ type: ConnectIntegrationDto })
  @ApiResponse({ status: 201, type: IntegrationResponse })
  async connect(@Body() dto: ConnectIntegrationDto): Promise<IntegrationRow> {
    return this.integrationService.connect(dto);
  }

  @Post('oauth/callback')
  @ApiOperation({ summary: 'OAuth callback handler (exchange code for token)' })
  @ApiBody({ type: OAuthCallbackDto })
  async oauthCallback(@Body() dto: OAuthCallbackDto): Promise<IntegrationRow> {
    return this.integrationService.oauthCallback(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List integrations with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'provider', required: false, enum: IntegrationProvider })
  async findAll(
    @Query() query: QueryIntegrationDto,
  ): Promise<{ data: IntegrationRow[]; meta: Record<string, unknown> }> {
    return this.integrationService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get an integration by ID' })
  @ApiResponse({ status: 200, type: IntegrationResponse })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  async findOne(@Param('id') id: string): Promise<IntegrationRow> {
    return this.integrationService.findById(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disconnect an integration and revoke token' })
  async disconnect(@Param('id') id: string): Promise<{ message: string }> {
    await this.integrationService.disconnect(id);
    return { message: 'Integration disconnected successfully' };
  }

  @Post(':id/webhook')
  @ApiOperation({ summary: 'Receive a provider webhook (signature verified)' })
  async webhook(
    @Param('id') id: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-hub-signature-256') githubSignature: string | undefined,
    @Headers('x-slack-signature') slackSignature: string | undefined,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    const signature = githubSignature ?? slackSignature ?? xSignature;
    const rawBody = JSON.stringify(payload ?? {});
    void req;
    return this.integrationService.handleWebhook(id, signature, rawBody, payload ?? {});
  }

  @Get(':id/sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Trigger a sync for an integration' })
  async sync(
    @Param('id') id: string,
  ): Promise<{ integrationId: string; status: string; syncedAt: Date }> {
    return this.integrationService.sync(id);
  }
}
