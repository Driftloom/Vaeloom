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
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { ConnectorService, type ConnectorRow, type SyncStatus } from './connector.service';
import { ConnectorType, CreateConnectorDto } from './dto/create-connector.dto';
import { QueryConnectorDto } from './dto/query-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { ConnectorResponse } from './entities/connector.entity';

@ApiTags('Connectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('connectors')
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new connector' })
  @ApiBody({ type: CreateConnectorDto })
  @ApiResponse({ status: 201, type: ConnectorResponse })
  async create(@Body() dto: CreateConnectorDto): Promise<ConnectorRow> {
    return this.connectorService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List connectors with pagination and type filter' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ConnectorType })
  async findAll(
    @Query() query: QueryConnectorDto,
  ): Promise<{ data: ConnectorRow[]; meta: Record<string, unknown> }> {
    return this.connectorService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a connector by ID' })
  @ApiResponse({ status: 200, type: ConnectorResponse })
  @ApiResponse({ status: 404, description: 'Connector not found' })
  async findOne(@Param('id') id: string): Promise<ConnectorRow> {
    return this.connectorService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a connector configuration' })
  @ApiBody({ type: UpdateConnectorDto })
  @ApiResponse({ status: 200, type: ConnectorResponse })
  async update(@Param('id') id: string, @Body() dto: UpdateConnectorDto): Promise<ConnectorRow> {
    return this.connectorService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a connector' })
  @ApiResponse({ status: 200, description: 'Connector removed' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.connectorService.remove(id);
    return { message: 'Connector removed successfully' };
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger a connector sync' })
  @ApiResponse({ status: 201, description: 'Sync triggered' })
  async sync(@Param('id') id: string): Promise<SyncStatus> {
    return this.connectorService.triggerSync(id);
  }

  @Get(':id/sync/status')
  @ApiOperation({ summary: 'Get the last sync status of a connector' })
  async syncStatus(@Param('id') id: string): Promise<SyncStatus> {
    return this.connectorService.getSyncStatus(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test the connector connection' })
  async test(@Param('id') id: string): Promise<{ ok: boolean; message: string }> {
    return this.connectorService.testConnection(id);
  }
}
