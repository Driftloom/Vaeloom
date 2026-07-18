import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'memory.created' })
  type: string;

  @ApiProperty({ example: 'memory-store' })
  source: string;

  @ApiProperty({ enum: ['memory', 'agent', 'auth', 'billing', 'system', 'sync', 'user', 'integration'] })
  category: string;

  @ApiProperty({ enum: ['PUBLISHED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING'] })
  status: string;

  @ApiProperty({ enum: ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] })
  priority: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  correlationId: string;

  @ApiPropertyOptional()
  causationId?: string;

  @ApiProperty({ example: { entityId: 'abc-123' } })
  payload: Record<string, unknown>;

  @ApiProperty()
  metadata: Record<string, unknown>;

  @ApiProperty()
  tenantId: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  maxRetries: number;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  publishedAt?: Date;
}
