import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum IntegrationProvider {
  SLACK = 'slack',
  GITHUB = 'github',
  NOTION = 'notion',
  GOOGLE_DRIVE = 'google-drive',
  EMAIL = 'email',
  CALENDAR = 'calendar',
}

export class ConnectIntegrationDto {
  @ApiProperty({ enum: IntegrationProvider })
  @IsEnum(IntegrationProvider)
  provider!: IntegrationProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'OAuth authorization code to exchange for a token' })
  @ValidateIf((o: ConnectIntegrationDto) => !o.token)
  @IsString()
  @MinLength(1)
  oauthCode?: string;

  @ApiPropertyOptional({ description: 'Directly supplied access token' })
  @ValidateIf((o: ConnectIntegrationDto) => !o.oauthCode)
  @IsString()
  @MinLength(1)
  token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalAccountId?: string;
}
