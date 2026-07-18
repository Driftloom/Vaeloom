import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { PermissionsService, ActionType } from '../../permissions/permissions.service';
import type { AuthedUser } from '../../auth/jwt.strategy';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private permissions: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { id, workspaceId } = request.params; // Support both :id and :workspaceId
    
    const targetWorkspaceId = workspaceId || id;
    
    // If no workspaceId is in params, skip workspace-level permission check for now
    if (!targetWorkspaceId) {
      return true;
    }

    const user = (request as any).user as AuthedUser | undefined;
    const agent = (request as any).agent as { name: string } | undefined;

    return this.permissions.check({
      workspaceId: targetWorkspaceId as string,
      userId: user?.id,
      agentName: agent?.name,
      actionType: this.resolveActionType(request),
      resource: this.resolveResource(request),
    });
  }

  private resolveActionType(request: Request): ActionType {
    switch (request.method) {
      case 'GET': return 'read';
      case 'POST': return 'write';
      case 'PUT': 
      case 'PATCH': return 'write';
      case 'DELETE': return 'act';
      default: return 'read';
    }
  }

  private resolveResource(request: Request): string {
    const pathParts = request.path.split('/');
    // e.g. /workspaces/123/documents -> documents
    // This is a naive extraction for MVP logging purposes
    const resourceIndex = pathParts.findIndex(p => p === 'workspaces') + 2;
    if (resourceIndex > 1 && resourceIndex < pathParts.length) {
      return pathParts[resourceIndex] || 'unknown';
    }
    return 'unknown';
  }
}
