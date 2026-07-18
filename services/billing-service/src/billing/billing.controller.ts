import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import {
  CreateSubscriptionDto,
  GenerateInvoiceDto,
  ListInvoiceQueryDto,
  ListUsageQueryDto,
  RecordUsageDto,
  UpdateSubscriptionDto,
} from './dto/billing.dto';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create a subscription (charges via Stripe)' })
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.billingService.createSubscription(dto);
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get a subscription by id' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(@Param('id') id: string) {
    return this.billingService.getSubscription(id);
  }

  @Put('subscriptions/:id')
  @ApiOperation({ summary: 'Update a subscription (cancel or change plan)' })
  async updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.billingService.updateSubscription(id, dto);
  }

  @Post('usage')
  @ApiOperation({ summary: 'Record usage for metering' })
  async recordUsage(@Body() dto: RecordUsageDto) {
    return this.billingService.recordUsage(dto);
  }

  @Get('usage')
  @ApiOperation({ summary: 'List usage records with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'metric', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async listUsage(@Query() query: ListUsageQueryDto) {
    return this.billingService.listUsage(query);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Generate an invoice from usage and plan' })
  async generateInvoice(@Body() dto: GenerateInvoiceDto) {
    return this.billingService.generateInvoice(dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async listInvoices(@Query() query: ListInvoiceQueryDto) {
    return this.billingService.listInvoices(query);
  }

  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Stripe webhook handler' })
  async stripeWebhook(@Req() req: Request) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available');
    }
    const signature = req.headers['stripe-signature'] as string | undefined;
    return this.billingService.handleStripeWebhook(rawBody, signature);
  }
}
