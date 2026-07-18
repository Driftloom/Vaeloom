import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateNodeDto } from './dto/create-node.dto';
import { QueryEdgeDto, QueryNodeDto, ShortestPathDto, TraverseDto } from './dto/query-edge.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { KnowledgeGraphService } from './knowledge-graph.service';

@ApiTags('Knowledge Graph')
@ApiBearerAuth()
@Controller('graph')
export class KnowledgeGraphController {
  constructor(private readonly kgService: KnowledgeGraphService) {}

  @Post('nodes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a knowledge node with embedding computation' })
  async createNode(@Body() dto: CreateNodeDto) {
    const data = await this.kgService.createNode(dto);
    return { data };
  }

  @Get('nodes')
  @ApiOperation({ summary: 'List nodes with pagination and filters' })
  async findAllNodes(@Query() query: QueryNodeDto) {
    return this.kgService.findAllNodes(query);
  }

  @Get('nodes/:id')
  @ApiOperation({ summary: 'Get node with connected edge count' })
  async findNodeById(@Param('id') id: string) {
    const data = await this.kgService.findNodeById(id);
    return { data };
  }

  @Put('nodes/:id')
  @ApiOperation({ summary: 'Update node (recomputes embedding if label/description changed)' })
  async updateNode(@Param('id') id: string, @Body() dto: UpdateNodeDto) {
    const data = await this.kgService.updateNode(id, dto);
    return { data };
  }

  @Delete('nodes/:id')
  @ApiOperation({ summary: 'Delete node and all its edges' })
  async deleteNode(@Param('id') id: string) {
    return this.kgService.deleteNode(id);
  }

  @Post('nodes/:id/edges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an edge from the specified node' })
  async createEdge(@Param('id') sourceId: string, @Body() dto: CreateEdgeDto) {
    const data = await this.kgService.createEdge(sourceId, dto);
    return { data };
  }

  @Get('nodes/:id/edges')
  @ApiOperation({ summary: 'List edges for a node with source/target nodes' })
  async findEdgesByNode(@Param('id') nodeId: string, @Query() query: QueryEdgeDto) {
    return this.kgService.findEdgesByNode(nodeId, query);
  }

  @Get('edges')
  @ApiOperation({ summary: 'List all edges with pagination' })
  async findAllEdges(@Query() query: QueryEdgeDto) {
    return this.kgService.findAllEdges(query);
  }

  @Delete('edges/:id')
  @ApiOperation({ summary: 'Delete an edge' })
  async deleteEdge(@Param('id') id: string) {
    return this.kgService.deleteEdge(id);
  }

  @Post('traverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BFS/DFS traversal from a node' })
  async traverse(@Body() dto: TraverseDto) {
    return this.kgService.traverse(dto);
  }

  @Get('path')
  @ApiOperation({ summary: 'Find shortest path between two nodes (BFS)' })
  async findShortestPath(@Query() dto: ShortestPathDto) {
    return this.kgService.findShortestPath(dto);
  }
}
