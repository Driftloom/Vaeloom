import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Agent, AgentExecution, PaginatedResponse } from '@vaeloom/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ExecuteAgentDto } from './dto/execute-agent.dto';
import type { Request, Response } from 'express';

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

  @Get(':id/execute/stream')
  @ApiOperation({ summary: 'Execute an agent with SSE streaming' })
  async executeStream(
    @CurrentUser() user: AuthedUser,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const aiUrl = `${(this.agents as any).aiServiceUrl}/agents/${id}/execute/stream`;

    try {
      const apiRes = await fetch(aiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': user.id,
        },
        body: JSON.stringify({ input: req.query, tenantId: user.id }),
      });

      if (!apiRes.ok) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'AI service error' })}\n\n`);
        res.end();
        return;
      }

      const reader = apiRes.body?.getReader();
      if (!reader) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'No response body' })}\n\n`);
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      req.on('close', () => { reader.cancel(); });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } catch {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream failed' })}\n\n`);
      res.end();
    }
  }
}
