import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
  ExecutionQueryDto,
  ListAgentsQueryDto,
  RegisterAgentDto,
  RunAgentDto,
  ScheduleAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto';
import { AgentResponse, AgentExecutionResponse, AgentScheduleResponse } from './entities/agent.entity';
import { AgentService } from './agent.service';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new agent' })
  @ApiBody({ type: RegisterAgentDto })
  @ApiResponse({ status: 201, type: AgentResponse })
  async register(@Body() dto: RegisterAgentDto) {
    return this.agentService.register(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List agents with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() query: ListAgentsQueryDto) {
    return this.agentService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent by id' })
  @ApiResponse({ status: 200, type: AgentResponse })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async findOne(@Param('id') id: string) {
    return this.agentService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an agent' })
  @ApiBody({ type: UpdateAgentDto })
  @ApiResponse({ status: 200, type: AgentResponse })
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate an agent' })
  @ApiResponse({ status: 200, type: AgentResponse })
  async deactivate(@Param('id') id: string) {
    return this.agentService.deactivate(id);
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Trigger agent execution via the AI service' })
  @ApiBody({ type: RunAgentDto })
  @ApiResponse({ status: 201, type: AgentExecutionResponse })
  async run(@Param('id') id: string, @Body() dto: RunAgentDto) {
    return this.agentService.run(id, dto);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'List executions for an agent' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findExecutions(@Param('id') id: string, @Query() query: ExecutionQueryDto) {
    return this.agentService.findExecutions(id, query);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Create a cron schedule for an agent' })
  @ApiBody({ type: ScheduleAgentDto })
  @ApiResponse({ status: 201, type: AgentScheduleResponse })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleAgentDto) {
    return this.agentService.schedule(id, dto);
  }
}
