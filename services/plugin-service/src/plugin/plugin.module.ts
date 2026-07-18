import { Module } from '@nestjs/common';

import { MetricsModule } from '../metrics/metrics.module';
import { PluginController } from './plugin.controller';
import { PluginService } from './plugin.service';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [MetricsModule],
  controllers: [PluginController],
  providers: [PluginService, SandboxService],
  exports: [PluginService, SandboxService],
})
export class PluginModule {}
