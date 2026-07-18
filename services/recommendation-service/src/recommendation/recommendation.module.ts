import { Module } from '@nestjs/common';

import { MetricsModule } from '../metrics/metrics.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  imports: [MetricsModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
