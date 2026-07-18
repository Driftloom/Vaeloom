import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { PluginStatus } from './register-plugin.dto';

export class QueryPluginDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: PluginStatus })
  @IsOptional()
  @IsEnum(PluginStatus)
  status?: PluginStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
