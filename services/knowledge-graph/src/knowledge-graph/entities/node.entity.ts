import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NodeEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Machine Learning' })
  label: string;

  @ApiProperty({ enum: ['concept', 'entity', 'document', 'topic', 'person', 'organization', 'event', 'project'] })
  type: string;

  @ApiPropertyOptional({ example: 'A subfield of artificial intelligence' })
  description?: string;

  @ApiProperty({ example: 0.8 })
  importance: number;

  @ApiProperty({ example: { domain: 'AI' } })
  properties: Record<string, unknown>;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-44665544000a' })
  tenantId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  edgeCount?: number;
}
