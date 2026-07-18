import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Memory, PaginatedResponse } from '@vaeloom/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { SearchMemoryDto } from './dto/search-memory.dto';
import { MemoryService } from './memory.service';

@ApiTags('memories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memories')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new memory' })
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateMemoryDto): Promise<Memory> {
    return this.memory.create(dto as unknown as Record<string, unknown>, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all memories (paginated)' })
  findAll(
    @CurrentUser() user: AuthedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PaginatedResponse<Memory>> {
    return this.memory.findAll(user.id, { page, pageSize });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single memory by ID' })
  findOne(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<Memory> {
    return this.memory.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a memory' })
  update(@CurrentUser() user: AuthedUser, @Param('id') id: string, @Body() dto: CreateMemoryDto): Promise<Memory> {
    return this.memory.update(id, dto as unknown as Record<string, unknown>, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a memory' })
  remove(@CurrentUser() user: AuthedUser, @Param('id') id: string): Promise<void> {
    return this.memory.remove(id, user.id);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search memories by query' })
  search(@CurrentUser() user: AuthedUser, @Body() dto: SearchMemoryDto): Promise<PaginatedResponse<Memory>> {
    return this.memory.search(dto.query, user.id, { types: dto.types, tags: dto.tags, limit: dto.limit, offset: dto.offset });
  }
}
