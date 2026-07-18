import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async index(@Res() res: Response): Promise<void> {
    const metrics = await this.metrics.getMetrics();
    res.setHeader('Content-Type', this.metrics.contentType);
    res.send(metrics);
  }
}
