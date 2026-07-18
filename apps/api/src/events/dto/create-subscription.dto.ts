import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  eventType!: string;

  @IsString()
  handlerId!: string;

  @IsString()
  handlerType!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
