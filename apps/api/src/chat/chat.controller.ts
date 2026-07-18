import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { InternalAiService } from '../common/services/internal-ai.service';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workspaces/:workspaceId/chat')
export class ChatController {
  constructor(private readonly aiService: InternalAiService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to the AI orchestrator' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async sendMessage(
    @Param('workspaceId') workspaceId: string,
    @Body('message') message: string,
    @Body('agentName') agentName?: string,
  ): Promise<any> {
    // Proxy the request to the Python ai-service Orchestrator over the internal RPC boundary
    return this.aiService.sendChatMessage(workspaceId, message, agentName);
  }
}
