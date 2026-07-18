import { Module } from '@nestjs/common';

import { RbacController, RoleController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  controllers: [RbacController, RoleController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
