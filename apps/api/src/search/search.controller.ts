import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthedUser } from '../auth/jwt.strategy';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Unified search across memories and knowledge graph' })
  searchUnified(@CurrentUser() user: AuthedUser, @Body() dto: SearchRequestDto): Promise<any> {
    return this.search.searchAll(dto.query, user.id, dto.sources, dto.limit);
  }
}
