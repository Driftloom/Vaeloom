import { IsEnum, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConnectorType {
  REST = 'rest',
  GRAPHQL = 'graphql',
  DATABASE = 'database',
  FILE = 'file',
}

export class CreateConnectorDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: ConnectorType })
  @IsEnum(ConnectorType)
  type!: ConnectorType;

  @ApiProperty({ type: Object, description: 'Connector-specific configuration' })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;
}
