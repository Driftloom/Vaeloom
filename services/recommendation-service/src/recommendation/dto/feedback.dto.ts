import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FeedbackDto {
  @ApiProperty({ example: 'rec-123' })
  @IsString()
  recommendationId!: string;

  @ApiProperty({ description: 'Whether the recommendation was useful' })
  @IsBoolean()
  useful!: boolean;
}
