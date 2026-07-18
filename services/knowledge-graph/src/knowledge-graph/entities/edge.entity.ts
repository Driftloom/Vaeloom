import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { NodeEntity } from './node.entity';

export class EdgeEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  sourceId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  targetId: string;

  @ApiProperty({ example: 'related_to' })
  relationship: string;

  @ApiProperty({ example: 0.85 })
  weight: number;

  @ApiPropertyOptional({ example: { context: 'research paper' } })
  properties: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  source?: NodeEntity;

  @ApiPropertyOptional()
  target?: NodeEntity;
}
