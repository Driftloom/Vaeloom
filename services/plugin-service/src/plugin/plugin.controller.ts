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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { RegisterPluginDto } from './dto/register-plugin.dto';
import { QueryPluginDto } from './dto/query-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import { ExecutePluginDto } from './dto/execute-plugin.dto';
import {
  ExecutionRow,
  PluginRow,
} from './entities/plugin.entity';
import { PluginService } from './plugin.service';

@ApiTags('Plugins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('plugins')
export class PluginController {
  constructor(private readonly pluginService: PluginService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new plugin' })
  @ApiResponse({ status: 201, type: Object })
  async register(@Body() dto: RegisterPluginDto): Promise<PluginRow> {
    return this.pluginService.register(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List plugins with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['REGISTERED', 'ACTIVE', 'DISABLED', 'FAILED'] })
  @ApiQuery({ name: 'tags', required: false, isArray: true, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() queryDto: QueryPluginDto) {
    return this.pluginService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a plugin by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: Object })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  async findOne(@Param('id') id: string): Promise<PluginRow> {
    return this.pluginService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a plugin (version bump, status, etc.)' })
  @ApiParam({ name: 'id' })
  async update(@Param('id') id: string, @Body() dto: UpdatePluginDto): Promise<PluginRow> {
    return this.pluginService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unregister a plugin' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.pluginService.remove(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a plugin in a sandbox' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 201, type: Object })
  async execute(@Param('id') id: string, @Body() dto: ExecutePluginDto): Promise<ExecutionRow> {
    return this.pluginService.execute(id, dto);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'List declared permissions for a plugin' })
  @ApiParam({ name: 'id' })
  async getPermissions(@Param('id') id: string): Promise<{ permissions: Record<string, unknown> }> {
    return this.pluginService.getPermissions(id);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'List executions of a plugin' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getExecutions(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ): Promise<{ data: ExecutionRow[]; meta: Record<string, unknown> }> {
    return this.pluginService.getExecutions(id, Number(page), Number(pageSize));
  }
}
