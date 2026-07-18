import { Expose, Transform, Type } from 'class-transformer';

export class SubscriptionResponse {
  @Expose() id!: string;
  @Expose() plan!: string;
  @Expose() status!: string;
  @Expose() stripeCustomerId?: string;
  @Expose() stripeSubscriptionId?: string;
  @Expose() tenantId!: string;
  @Expose() currentPeriodStart?: Date;
  @Expose() currentPeriodEnd?: Date;
  @Expose() @Type(() => Date) createdAt!: Date;
  @Expose() @Type(() => Date) updatedAt!: Date;
}

export class UsageRecordResponse {
  @Expose() id!: string;
  @Expose() metric!: string;
  @Expose() value!: number;
  @Expose() tenantId!: string;
  @Expose() @Type(() => Date) recordedAt!: Date;
}

export class InvoiceResponse {
  @Expose() id!: string;
  @Expose() tenantId!: string;
  @Expose() amountCents!: number;
  @Expose() currency!: string;
  @Expose() status!: string;
  @Expose() periodStart?: Date;
  @Expose() periodEnd?: Date;
  @Expose() lineItems!: Array<Record<string, unknown>>;
  @Expose() @Type(() => Date) createdAt!: Date;
}
