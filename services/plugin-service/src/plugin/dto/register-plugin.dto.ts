import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum PluginStatus {
  REGISTERED = 'REGISTERED',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  FAILED = 'FAILED',
}

export class PluginPermissionsDto {
  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memory?: ('read' | 'write' | 'delete')[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agents?: ('execute' | 'configure')[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: ('publish' | 'subscribe')[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storage?: ('read' | 'write')[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  network?: ('outbound' | 'webhook')[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  files?: ('read' | 'write')[];
}

export class RegisterPluginDto {
  @ApiProperty({ example: 'my-plugin' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  author!: string;

  @ApiProperty({ example: 'An example plugin' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 'MIT' })
  @IsString()
  license!: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  minAppVersion!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tags!: string[];

  @ApiProperty({ type: PluginPermissionsDto })
  @ValidateNested()
  @Type(() => PluginPermissionsDto)
  permissions!: PluginPermissionsDto;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  capabilities!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  hooks!: string[];

  @ApiProperty({ example: 'dist/index.js' })
  @IsString()
  @MinLength(1)
  entryPoint!: string;

  @ApiProperty({ example: 'tenant-123' })
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  homepage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  repository?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  configSchema?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Source code blob to execute' })
  @IsOptional()
  @IsString()
  code?: string;
}
