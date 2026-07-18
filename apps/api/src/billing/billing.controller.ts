import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { BillingService } from './billing.service';
import { UsageQueryDto } from './dto/usage-query.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Get usage records' })
  getUsage(@CurrentUser() user: AuthedUser, @Query() query: UsageQueryDto) {
    return this.billing.getUsage(user.id, query.metric, query.from, query.to);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription' })
  getSubscription(@CurrentUser() user: AuthedUser) {
    return this.billing.getSubscription(user.id);
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Create or update subscription' })
  createSubscription(@CurrentUser() user: AuthedUser, @Body() dto: CreateSubscriptionDto) {
    return this.billing.createSubscription(user.id, dto.plan);
  }
}
