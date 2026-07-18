import { Expose, Transform, Type } from 'class-transformer';

export class RoleResponse {
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  permissions!: Array<{ resource: string; action: string; conditions?: Record<string, unknown> }>;
  @Expose() @Type(() => Date) createdAt!: Date;
  @Expose() @Type(() => Date) updatedAt!: Date;
}

export class CheckPermissionResponse {
  @Expose() userId!: string;
  @Expose() resource!: string;
  @Expose() action!: string;
  @Expose() granted!: boolean;
}
