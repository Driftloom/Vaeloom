import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
// Note: InternalAiService is exported by AppModule so it's globally available when imported

@Module({
  imports: [PrismaModule],
  controllers: [ResumesController],
  providers: [ResumesService],
})
export class ResumesModule {}
