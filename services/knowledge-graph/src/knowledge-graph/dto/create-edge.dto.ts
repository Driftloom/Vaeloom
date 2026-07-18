import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateEdgeDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsString()
  targetId: string;

  @ApiProperty({ example: 'related_to' })
  @IsString()
  relationship: string;

  @ApiPropertyOptional({ example: 0.85 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;

  @ApiPropertyOptional({ example: { context: 'research paper' } })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
