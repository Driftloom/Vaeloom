import { Expose, Type } from 'class-transformer';

export class UsageTimePoint {
  @Expose()
  date!: string;

  @Expose()
  memoriesCreated!: number;

  @Expose()
  agentsRun!: number;

  @Expose()
  tokensUsed!: number;
}

export class KpiSummary {
  @Expose()
  totalMemories!: number;

  @Expose()
  totalAgents!: number;

  @Expose()
  activeUsers!: number;

  @Expose()
  avgResponseTimeMs!: number;
}

export class DashboardPayload {
  @Expose()
  kpis!: KpiSummary;

  @Expose()
  @Type(() => UsageTimePoint)
  usage!: UsageTimePoint[];

  @Expose()
  @Type(() => Date)
  generatedAt!: Date;
}

export class TrackEventResponse {
  @Expose()
  id!: string;

  @Expose()
  message!: string;
}

export class AggregateResponse {
  @Expose()
  date!: string;

  @Expose()
  recordsCreated!: number;

  @Expose()
  message!: string;
}
