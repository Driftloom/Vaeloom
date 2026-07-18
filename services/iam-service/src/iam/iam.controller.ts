import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { AssignRolesDto, CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/iam.dto';
import { IamService } from './iam.service';

@ApiTags('IAM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('users')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  async create(@Body() dto: CreateUserDto) {
    return this.iamService.createUser(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users with pagination and tenant filter' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  async list(@Query() query: ListUsersQueryDto) {
    return this.iamService.listUsers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user with roles' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async get(@Param('id') id: string) {
    return this.iamService.getUser(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.iamService.updateUser(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user (soft delete)' })
  async remove(@Param('id') id: string) {
    await this.iamService.deactivateUser(id);
    return { message: 'User deactivated' };
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'Assign roles to a user' })
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    return this.iamService.assignRoles(id, dto);
  }

  @Delete(':id/roles/:roleId')
  @ApiOperation({ summary: 'Remove a role from a user' })
  async removeRole(@Param('id') id: string, @Param('roleId') roleId: string) {
    await this.iamService.removeRole(id, roleId);
    return { message: 'Role removed' };
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Compute effective permissions for a user' })
  async permissions(@Param('id') id: string) {
    return this.iamService.getPermissions(id);
  }
}
