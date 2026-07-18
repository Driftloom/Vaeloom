import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SourceType {
  UPLOAD = 'upload',
  URL = 'url',
  IMPORT = 'import',
  SYNC = 'sync',
  API = 'api',
}

export class IngestDocumentDto {
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ description: 'Raw text content of the document' })
  @ValidateIf((o: IngestDocumentDto) => !o.url)
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'URL to fetch document content from' })
  @ValidateIf((o: IngestDocumentDto) => !o.content)
  @IsUrl()
  url?: string;

  @ApiProperty({ enum: SourceType })
  @IsEnum(SourceType)
  sourceType!: SourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  connectorId?: string;
}
