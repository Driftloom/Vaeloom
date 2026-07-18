import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export class PermissionDto {
  @ApiProperty({ example: 'document' })
  @IsString()
  @MinLength(1)
  resource!: string;

  @ApiProperty({ example: 'read' })
  @IsString()
  @MinLength(1)
  action!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  conditions?: Record<string, unknown>;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'editor' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ type: [PermissionDto] })
  @IsOptional()
  @IsArray()
  permissions?: PermissionDto[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'editor' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ type: [PermissionDto] })
  @IsOptional()
  @IsArray()
  permissions?: PermissionDto[];
}

export class AddPermissionDto {
  @ApiProperty({ type: PermissionDto })
  permission!: PermissionDto;
}

export class CheckPermissionDto {
  @ApiProperty({ example: 'user-123' })
  @IsString()
  @MinLength(1)
  userId!: string;

  @ApiProperty({ example: 'document' })
  @IsString()
  @MinLength(1)
  resource!: string;

  @ApiProperty({ example: 'read' })
  @IsString()
  @MinLength(1)
  action!: string;

  @ApiPropertyOptional({ description: 'Tenant identifier' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
