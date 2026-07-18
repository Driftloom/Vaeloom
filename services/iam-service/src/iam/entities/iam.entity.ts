import { Expose, Type } from 'class-transformer';

export class RoleRef {
  @Expose() id!: string;
  @Expose() name!: string;
}

export class UserResponse {
  @Expose() id!: string;
  @Expose() email!: string;
  @Expose() displayName!: string;
  @Expose() tenantId!: string;
  @Expose() active!: boolean;
  @Expose() @Type(() => RoleRef) roles!: RoleRef[];
  @Expose() @Type(() => Date) createdAt!: Date;
  @Expose() @Type(() => Date) updatedAt!: Date;
}
