import { IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  plan!: string;

  @IsOptional()
  @IsString()
  stripePaymentMethodId?: string;
}
