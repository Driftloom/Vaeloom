import {
  Body,
  Controller,
  Get,
  Post,
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
import {
  IndexDto,
  SearchFeedbackDto,
  SearchQueryDto,
  SuggestQueryDto,
} from './dto/search.dto';
import { SearchResultItem, SuggestionItem, FeedbackResponse } from './entities/search.entity';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOperation({ summary: 'Unified vector + keyword search across memories and knowledge nodes' })
  @ApiBody({ type: SearchQueryDto })
  @ApiResponse({ status: 201, type: SearchResultItem, isArray: true })
  async search(@Body() dto: SearchQueryDto) {
    return this.searchService.unifiedSearch(dto);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete title suggestions' })
  @ApiQuery({ name: 'prefix', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: SuggestionItem, isArray: true })
  async suggest(@Query() dto: SuggestQueryDto) {
    return this.searchService.suggest(dto);
  }

  @Post('index')
  @ApiOperation({ summary: 'Trigger embedding regeneration / reindex' })
  @ApiBody({ type: IndexDto })
  async reindex(@Body() dto: IndexDto) {
    return this.searchService.reindex(dto);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Record a search result click for ranking improvement' })
  @ApiBody({ type: SearchFeedbackDto })
  @ApiResponse({ status: 201, type: FeedbackResponse })
  async feedback(@Body() dto: SearchFeedbackDto) {
    return this.searchService.recordFeedback(dto);
  }
}
