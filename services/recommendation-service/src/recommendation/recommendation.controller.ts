import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { GenerateRecommendationDto } from './dto/generate-recommendation.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { TrendingQueryDto } from './dto/trending-query.dto';
import { IndexDto } from './dto/index.dto';
import {
  FeedbackRow,
  RecommendationItem,
  RecommendationRow,
} from './entities/recommendation.entity';
import { RecommendationService } from './recommendation.service';

@ApiTags('Recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post()
  @ApiOperation({ summary: 'Generate recommendations for a user' })
  @ApiResponse({ status: 201, type: Object })
  async generate(@Body() dto: GenerateRecommendationDto): Promise<RecommendationRow> {
    return this.recommendationService.generate(dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get stored recommendations for a user' })
  @ApiParam({ name: 'userId' })
  async getByUser(@Param('userId') userId: string): Promise<RecommendationRow[]> {
    return this.recommendationService.getByUser(userId);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Record feedback for a recommendation' })
  async feedback(@Body() dto: FeedbackDto): Promise<FeedbackRow> {
    return this.recommendationService.recordFeedback(dto);
  }

  @Get('trending')
  @ApiOperation({ summary: 'List trending items across the tenant' })
  async trending(@Query() queryDto: TrendingQueryDto): Promise<RecommendationItem[]> {
    return this.recommendationService.getTrending(queryDto);
  }

  @Post('index')
  @ApiOperation({ summary: 'Reindex user preference vectors' })
  async reindex(@Body() dto: IndexDto): Promise<{ userIds: number; updatedAt: string }> {
    return this.recommendationService.reindex(dto);
  }
}
