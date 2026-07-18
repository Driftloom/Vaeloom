import {
  Body,
  Controller,
  Get,
  Param,
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
import {
  ComplianceReportQueryDto,
  ExportAuditDto,
  QueryAuditEventsDto,
  RecordAuditEventDto,
} from './dto/audit.dto';
import { AuditEventResponse, ComplianceReport, ExportResponse } from './entities/audit.entity';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('events')
  @ApiOperation({ summary: 'Record an immutable audit event (append-only)' })
  @ApiBody({ type: RecordAuditEventDto })
  @ApiResponse({ status: 201, type: AuditEventResponse })
  async record(@Body() dto: RecordAuditEventDto) {
    return this.auditService.recordEvent(dto);
  }

  @Get('events')
  @ApiOperation({ summary: 'Query audit events with filters, paginated' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'resourceId', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async findAll(@Query() query: QueryAuditEventsDto) {
    return this.auditService.findAll(query);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get a single audit event' })
  @ApiResponse({ status: 200, type: AuditEventResponse })
  @ApiResponse({ status: 404, description: 'Audit event not found' })
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }

  @Post('export')
  @ApiOperation({ summary: 'Compliance export (CSV/JSON) for a date range + tenant' })
  @ApiBody({ type: ExportAuditDto })
  @ApiResponse({ status: 201, type: ExportResponse })
  async export(@Body() dto: ExportAuditDto) {
    return this.auditService.exportEvents(dto);
  }

  @Get('compliance/report')
  @ApiOperation({ summary: 'Summary compliance report by action and resource' })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiResponse({ status: 200, type: ComplianceReport })
  async complianceReport(@Query() query: ComplianceReportQueryDto) {
    return this.auditService.complianceReport(query);
  }
}
