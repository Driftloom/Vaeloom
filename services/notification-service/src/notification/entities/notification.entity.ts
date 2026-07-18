import { Expose, Type } from 'class-transformer';

export class NotificationResponse {
  @Expose() id!: string;
  @Expose() channel!: string;
  @Expose() recipient!: string;
  @Expose() subject?: string;
  @Expose() body!: string;
  @Expose() status!: string;
  @Expose() @Type(() => Date) createdAt!: Date;
  @Expose() @Type(() => Date) updatedAt!: Date;
}

export class TemplateResponse {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() subject?: string;
  @Expose() body!: string;
  @Expose() channel!: string;
  @Expose() @Type(() => Date) createdAt!: Date;
}

export class SubscriberResponse {
  @Expose() id!: string;
  @Expose() url!: string;
  @Expose() tenantId?: string;
  @Expose() @Type(() => Date) createdAt!: Date;
}
