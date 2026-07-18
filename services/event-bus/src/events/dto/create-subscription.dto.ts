import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'memory.created' })
  @IsString()
  eventType: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  handlerId: string;

  @ApiPropertyOptional({ enum: ['service', 'agent', 'webhook', 'function'], default: 'service' })
  @IsOptional()
  @IsString()
  handlerType?: string = 'service';

  @ApiPropertyOptional({ example: { batchSize: 10, maxRetries: 3, timeoutMs: 5000, deadLetter: true } })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  handlerId?: string;

  @ApiPropertyOptional({ enum: ['service', 'agent', 'webhook', 'function'] })
  @IsOptional()
  @IsString()
  handlerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
