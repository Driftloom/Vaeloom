import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
// InternalAiService is provided by AppModule

@Module({
  controllers: [ChatController],
})
export class ChatModule {}
