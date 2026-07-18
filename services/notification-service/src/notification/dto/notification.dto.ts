import { IsArray, IsEmail, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  PUSH = 'push',
}

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ example: 'user@example.com or slack:#general or device token' })
  @IsString()
  @MinLength(1)
  recipient!: string;

  @ApiPropertyOptional({ example: 'welcome' })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiPropertyOptional({ type: Object, description: 'Template data for interpolation' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Subject line' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Body content' })
  @IsOptional()
  @IsString()
  body?: string;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'welcome' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'Welcome!' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Hello {{name}}' })
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;
}

export class ListNotificationQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class SubscribeDto {
  @ApiProperty({ example: 'https://example.com/hooks/notify' })
  @IsString()
  @MinLength(1)
  url!: string;

  @ApiPropertyOptional({ description: 'Tenant identifier' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class WebhookReceiptDto {
  @ApiPropertyOptional({ enum: ['delivered', 'failed', 'bounced'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  details?: Record<string, unknown>;
}
