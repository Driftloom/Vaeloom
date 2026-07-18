import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { PluginPermissionsDto } from './register-plugin.dto';

export class UpdatePluginDto {
  @ApiPropertyOptional({ example: '1.0.1' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entryPoint?: string;

  @ApiPropertyOptional({ type: PluginPermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PluginPermissionsDto)
  permissions?: PluginPermissionsDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hooks?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'DISABLED';
}

import { ArrayMinSize, IsArray } from 'class-validator';
