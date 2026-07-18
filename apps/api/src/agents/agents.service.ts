import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Agent, AgentExecution, PaginatedResponse } from '@vaeloom/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, timeout, retry, catchError } from 'rxjs';

@Injectable()
export class AgentsService {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('app.aiServiceUrl') ?? 'http://localhost:8000';
  }

  async create(dto: Record<string, unknown>, userId: string, tenantId: string): Promise<Agent> {
    const agent = await this.prisma.agent.create({
      data: {
        name: dto['name'] as string,
        description: dto['description'] as string | undefined,
        category: dto['category'] as string,
        config: dto['config'] as any,
        capabilities: (dto['capabilities'] ?? []) as string[],
        userId,
        tenantId,
      },
    });
    return agent as unknown as Agent;
  }

  async findAll(tenantId: string, params?: Record<string, unknown>): Promise<PaginatedResponse<Agent>> {
    const page = Number(params?.page ?? 1);
    const pageSize = Number(params?.pageSize ?? 20);
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.agent.findMany({
        where: { tenantId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agent.count({ where: { tenantId } }),
    ]);
    return { data: data as unknown as Agent[], meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: skip + pageSize < total, hasPrevious: page > 1 } };
  }

  async findOne(id: string, tenantId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({ where: { id, tenantId } });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent as unknown as Agent;
  }

  async execute(id: string, input: Record<string, unknown>, tenantId: string): Promise<AgentExecution> {
    return lastValueFrom(
      this.http.post<AgentExecution>(`${this.aiServiceUrl}/agents/${id}/execute`, { input, tenantId }).pipe(
        timeout(30000),
        retry(1),
        catchError((err) => { throw err; }),
      ),
    ).then((res) => res.data);
  }

  async getExecutions(agentId: string, tenantId: string): Promise<PaginatedResponse<AgentExecution>> {
    const [data, total] = await Promise.all([
      (this.prisma as any).agentExecution.findMany({
        where: { agentId, tenantId },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      (this.prisma as any).agentExecution.count({ where: { agentId, tenantId } }),
    ]);
    return { data: data as unknown as AgentExecution[], meta: { page: 1, pageSize: 20, total, totalPages: Math.ceil(total / 20), hasNext: total > 20, hasPrevious: false } };
  }
}
