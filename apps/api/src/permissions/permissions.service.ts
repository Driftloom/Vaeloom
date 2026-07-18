import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ActionType = 'read' | 'write' | 'act';

export interface PermissionCheckOptions {
  workspaceId: string;
  userId?: string;
  agentName?: string;
  actionType: ActionType;
  resource?: string;
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(options: PermissionCheckOptions): Promise<boolean> {
    const { workspaceId, userId, agentName, actionType, resource } = options;
    
    this.logger.debug(`Checking permissions: ${JSON.stringify(options)}`);

    // Verify workspace exists and user has access (if user request)
    if (userId) {
      const workspace = await this.prisma.workspace.findFirst({
        where: { id: workspaceId, userId },
      });
      if (!workspace) {
        this.logger.warn(`Permission denied: User ${userId} does not own Workspace ${workspaceId}`);
        return false;
      }
    }

    // If it's an agent acting on behalf of a user/workspace, check agent permissions
    if (agentName) {
      // In MVP, we might just trust the agent if the workspace is valid, 
      // but let's check the permissions table if there are specific grants.
      const permission = await this.prisma.permission.findFirst({
        where: {
          workspaceId,
          agentName,
          actionType,
          revokedAt: null,
        },
      });

      if (!permission) {
        this.logger.warn(`Permission denied: Agent ${agentName} lacks ${actionType} access to workspace ${workspaceId}`);
        return false;
      }
    }

    // Default to true if user owns workspace (basic RBAC for MVP)
    // Detailed resource-level ABAC will be expanded as needed.
    return true;
  }
}
