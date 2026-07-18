import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CreateJobDto } from './dto/create-job.dto';
import type { QueryJobDto } from './dto/query-job.dto';
import { JobExecutionResponse, JobResponse } from './entities/job.entity';
import { JobService } from './job.service';
import type { ScheduledJobRow } from './scheduler.service';

@ApiTags('Jobs')
@UseInterceptors(ResponseInterceptor)
@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a scheduled job' })
  @ApiBody({ type: CreateJobDto })
  @ApiResponse({ status: 201, type: JobResponse })
  async create(@Body() dto: CreateJobDto): Promise<ScheduledJobRow> {
    return this.jobService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List scheduled jobs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(@Query() query: QueryJobDto) {
    return this.jobService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a job by ID' })
  async findOne(@Param('id') id: string): Promise<ScheduledJobRow> {
    return this.jobService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a job' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateJobDto>): Promise<ScheduledJobRow> {
    return this.jobService.update(id, dto);
  }

  @Post(':id/pause')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pause a job' })
  async pause(@Param('id') id: string): Promise<ScheduledJobRow> {
    return this.jobService.pause(id);
  }

  @Post(':id/resume')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resume a job' })
  async resume(@Param('id') id: string): Promise<ScheduledJobRow> {
    return this.jobService.resume(id);
  }

  @Post(':id/trigger')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Trigger a job immediately' })
  async trigger(@Param('id') id: string) {
    return this.jobService.trigger(id);
  }

  @Get(':id/executions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List recent executions of a job' })
  @ApiResponse({ status: 200, type: [JobExecutionResponse] })
  async executions(@Param('id') id: string): Promise<JobExecutionResponse[]> {
    return this.jobService.executions(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a job' })
  async remove(@Param('id') id: string) {
    return this.jobService.remove(id);
  }
}
