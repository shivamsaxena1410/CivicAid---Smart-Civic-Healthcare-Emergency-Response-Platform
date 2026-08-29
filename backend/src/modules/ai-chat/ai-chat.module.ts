import { Module } from '@nestjs/common';
import { AIChatService } from './ai-chat.service';
import { AIChatController } from './ai-chat.controller';

@Module({
  controllers: [AIChatController],
  providers: [AIChatService],
  exports: [AIChatService],
})
export class AIChatModule {}
