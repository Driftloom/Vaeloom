import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { AddPermissionDto, CheckPermissionDto, CreateRoleDto, UpdateRoleDto } from './dto/rbac.dto';
import { RbacService } from './rbac.service';

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('permissions')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Post('check')
  @ApiOperation({ summary: 'Check if a user has a permission on resource:action' })
  async check(@Body() dto: CheckPermissionDto) {
    return this.rbacService.checkPermission(dto);
  }
}

@ApiTags('RBAC Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('roles')
export class RoleController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @ApiOperation({ summary: 'List roles with permissions' })
  async list() {
    return this.rbacService.listRoles();
  }

  @Post()
  @ApiOperation({ summary: 'Create a role' })
  async create(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a role' })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role' })
  async remove(@Param('id') id: string) {
    await this.rbacService.deleteRole(id);
    return { message: 'Role deleted' };
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Add a permission to a role' })
  async addPermission(@Param('id') id: string, @Body() dto: AddPermissionDto) {
    return this.rbacService.addPermission(id, dto);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'List permissions of a role' })
  async listPermissions(@Param('id') id: string) {
    return this.rbacService.listRolePermissions(id);
  }
}
