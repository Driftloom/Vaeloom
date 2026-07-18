import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import {
  CreateTemplateDto,
  ListNotificationQueryDto,
  SendNotificationDto,
  SubscribeDto,
  WebhookReceiptDto,
} from './dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a notification via email/slack/push' })
  async send(@Body() dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'channel', required: false, type: String })
  async list(@Query() query: ListNotificationQueryDto) {
    return this.notificationService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by id' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async get(@Param('id') id: string) {
    return this.notificationService.get(id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a notification template' })
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.notificationService.createTemplate(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List notification templates' })
  async listTemplates() {
    return this.notificationService.listTemplates();
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Register a webhook subscriber for notification events' })
  async subscribe(@Body() dto: SubscribeDto) {
    return this.notificationService.subscribe(dto);
  }

  @Post('webhooks/:id')
  @ApiOperation({ summary: 'Receive a delivery receipt for a notification' })
  async webhook(@Param('id') id: string, @Body() dto: WebhookReceiptDto) {
    await this.notificationService.receiveReceipt(id, dto);
    return { message: 'Receipt recorded' };
  }
}
