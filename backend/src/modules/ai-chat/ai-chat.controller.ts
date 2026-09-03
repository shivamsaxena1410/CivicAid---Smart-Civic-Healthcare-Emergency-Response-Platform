import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AIChatService } from './ai-chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Health Assistant')
@Controller('ai-chat')
export class AIChatController {
  constructor(private readonly aiChatService: AIChatService) {}

  @UseGuards(JwtAuthGuard)
  // This handler can call a metered third-party API, so it is the one endpoint
  // where an unbounded caller costs real money rather than just CPU.
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  @Post('message')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a health-related query to the CivicConnect AI assistant' })
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatMessageDto,
  ) {
    return this.aiChatService.processMessage(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve recent conversation history for the current user' })
  async getChatHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.aiChatService.getChatHistory(user.id);
  }
}
