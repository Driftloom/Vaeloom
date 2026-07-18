import {
  Body,
  Controller,
  Get,
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
import { AggregateDto, TrackEventDto, UsageQueryDto } from './dto/analytics.dto';
import {
  UsageTimePoint,
  KpiSummary,
  DashboardPayload,
  TrackEventResponse,
  AggregateResponse,
} from './entities/analytics.entity';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Time-series usage metrics grouped by day' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'interval', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiResponse({ status: 200, type: UsageTimePoint, isArray: true })
  async usage(@Query() query: UsageQueryDto) {
    return this.analyticsService.getUsage(query);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Aggregated KPIs' })
  @ApiResponse({ status: 200, type: KpiSummary })
  async metrics() {
    return this.analyticsService.getMetrics();
  }

  @Post('events')
  @ApiOperation({ summary: 'Track a custom analytics event' })
  @ApiBody({ type: TrackEventDto })
  @ApiResponse({ status: 201, type: TrackEventResponse })
  async trackEvent(@Body() dto: TrackEventDto) {
    return this.analyticsService.trackEvent(dto);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Combined dashboard payload' })
  @ApiResponse({ status: 200, type: DashboardPayload })
  async dashboard() {
    return this.analyticsService.getDashboard();
  }

  @Post('aggregate')
  @ApiOperation({ summary: 'Trigger daily aggregation job' })
  @ApiBody({ type: AggregateDto })
  @ApiResponse({ status: 201, type: AggregateResponse })
  async aggregate(@Body() dto: AggregateDto) {
    return this.analyticsService.aggregate(dto);
  }
}
