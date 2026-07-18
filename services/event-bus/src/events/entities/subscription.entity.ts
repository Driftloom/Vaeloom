import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'memory.created' })
  eventType: string;

  @ApiProperty()
  handlerId: string;

  @ApiProperty({ enum: ['service', 'agent', 'webhook', 'function'] })
  handlerType: string;

  @ApiProperty()
  config: Record<string, unknown>;

  @ApiPropertyOptional()
  filters?: Record<string, unknown>;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  createdAt: Date;
}
