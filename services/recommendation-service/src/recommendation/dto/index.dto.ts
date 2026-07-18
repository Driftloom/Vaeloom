import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class IndexDto {
  @ApiPropertyOptional({ example: 'user-123' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Tenant id filter' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
