import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing',
}

export class CreateSubscriptionDto {
  @ApiProperty({ enum: SubscriptionPlan })
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @ApiProperty({ description: 'Tenant identifier' })
  @IsString()
  @MinLength(1)
  tenantId!: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ description: 'Cancel the subscription' })
  @IsOptional()
  cancel?: boolean;
}

export class RecordUsageDto {
  @ApiProperty({ example: 'api_calls' })
  @IsString()
  @MinLength(1)
  metric!: string;

  @ApiProperty({ type: Number, example: 100 })
  @IsString()
  value!: number;

  @ApiProperty({ description: 'Tenant identifier' })
  @IsString()
  @MinLength(1)
  tenantId!: string;
}

export class ListUsageQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ example: 'api_calls' })
  @IsOptional()
  @IsString()
  metric?: string;

  @ApiPropertyOptional({ description: 'Tenant identifier' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class GenerateInvoiceDto {
  @ApiProperty({ description: 'Tenant identifier' })
  @IsString()
  @MinLength(1)
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Billing period start (ISO date)' })
  @IsOptional()
  @IsString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Billing period end (ISO date)' })
  @IsOptional()
  @IsString()
  periodEnd?: string;
}

export class ListInvoiceQueryDto {
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
