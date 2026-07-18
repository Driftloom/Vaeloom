import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiProperty({ description: 'Tenant identifier' })
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiPropertyOptional({ type: [String], description: 'Role ids to assign' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Deactivate the user' })
  @IsOptional()
  active?: boolean;
}

export class AssignRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Tenant identifier' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
