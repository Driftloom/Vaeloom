import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Agent, AgentExecution, PaginatedResponse } from '@vaeloom/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ExecuteAgentDto } from './dto/execute-agent.dto';

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateAgentDto): Promise<Agent> {
    return this.agents.create(dto as unknown as Record<string, unknown>, user.id, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all agents (paginated)' })
  findAll(
    @CurrentUser() user: AuthedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PaginatedResponse<Agent>> {
    return this.agents.findAll(user.id, { page, pageSize });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent by ID' })
  findOne(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<Agent> {
    return this.agents.findOne(id, user.id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute an agent with input' })
  execute(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Body() dto: ExecuteAgentDto,
  ): Promise<AgentExecution> {
    return this.agents.execute(id, dto.input, user.id);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'List executions for an agent' })
  getExecutions(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
  ): Promise<PaginatedResponse<AgentExecution>> {
    return this.agents.getExecutions(id, user.id);
  }
}
