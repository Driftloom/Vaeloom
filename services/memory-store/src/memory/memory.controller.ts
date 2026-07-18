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
import { CreateMemoryDto, MemoryType } from './dto/create-memory.dto';
import { QueryMemoryDto, MemoryStatus } from './dto/query-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { MemoryResponse } from './entities/memory.entity';
import { MemoryService, type MemoryRow } from './memory.service';

@ApiTags('Memories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new memory with embedding' })
  @ApiBody({ type: CreateMemoryDto })
  @ApiResponse({ status: 201, type: MemoryResponse })
  async create(@Body() dto: CreateMemoryDto): Promise<MemoryRow> {
    return this.memoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List memories with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'types', required: false, isArray: true, enum: MemoryType })
  @ApiQuery({ name: 'status', required: false, enum: MemoryStatus })
  @ApiQuery({ name: 'tags', required: false, isArray: true, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() queryDto: QueryMemoryDto): Promise<{ data: MemoryRow[]; meta: Record<string, unknown> }> {
    return this.memoryService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a memory by ID' })
  @ApiResponse({ status: 200, type: MemoryResponse })
  @ApiResponse({ status: 404, description: 'Memory not found' })
  async findOne(@Param('id') id: string): Promise<MemoryRow> {
    return this.memoryService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a memory (recomputes embedding if content changed)' })
  @ApiBody({ type: UpdateMemoryDto })
  @ApiResponse({ status: 200, type: MemoryResponse })
  async update(@Param('id') id: string, @Body() dto: UpdateMemoryDto): Promise<MemoryRow> {
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a memory' })
  @ApiResponse({ status: 200, description: 'Memory deleted' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.memoryService.softDelete(id);
    return { message: 'Memory deleted successfully' };
  }

  @Post('search')
  @ApiOperation({ summary: 'Vector similarity search using pgvector' })
  @ApiBody({ type: SearchMemoryDto })
  async search(@Body() dto: SearchMemoryDto): Promise<{ data: MemoryRow[]; meta: { total: number } }> {
    return this.memoryService.search(dto);
  }
}
