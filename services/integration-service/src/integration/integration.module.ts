import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CryptoService } from './crypto.service';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';

@Module({
  imports: [HttpModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, CryptoService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
