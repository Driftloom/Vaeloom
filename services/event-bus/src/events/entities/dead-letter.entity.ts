import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeadLetterEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty()
  originalEventId: string;

  @ApiProperty()
  error: string;

  @ApiProperty()
  errorCount: number;

  @ApiProperty()
  lastErrorAt: Date;

  @ApiProperty()
  payload: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;
}
