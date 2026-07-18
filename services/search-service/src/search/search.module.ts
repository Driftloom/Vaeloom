import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [HttpModule.register({ timeout: 20000, maxRedirects: 3 })],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
