import { PermissionGuard } from './permission.guard';
import { PermissionsService } from '../../permissions/permissions.service';
import { ExecutionContext } from '@nestjs/common';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let permissionsServiceMock: any;

  beforeEach(() => {
    permissionsServiceMock = {
      check: jest.fn(),
    };
    guard = new PermissionGuard(permissionsServiceMock as PermissionsService);
  });

  const mockExecutionContext = (reqProps: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => reqProps,
      }),
    } as any;
  };

  it('should allow if no workspaceId or id is in params', async () => {
    const ctx = mockExecutionContext({ params: {}, path: '/' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(permissionsServiceMock.check).not.toHaveBeenCalled();
  });

  it('should call check if workspaceId is present', async () => {
    permissionsServiceMock.check.mockResolvedValue(true);
    const ctx = mockExecutionContext({
      params: { workspaceId: 'ws-1' },
      user: { id: 'u-1' },
      method: 'POST',
      path: '/workspaces/ws-1/documents',
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(permissionsServiceMock.check).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      userId: 'u-1',
      agentName: undefined,
      actionType: 'write',
      resource: 'documents',
    });
  });

  it('should map GET to read', async () => {
    permissionsServiceMock.check.mockResolvedValue(true);
    const ctx = mockExecutionContext({ params: { id: 'ws-1' }, method: 'GET', path: '/workspaces/ws-1' });
    await guard.canActivate(ctx);
    expect(permissionsServiceMock.check.mock.calls[0][0].actionType).toBe('read');
  });

  it('should map PUT/PATCH to write', async () => {
    permissionsServiceMock.check.mockResolvedValue(true);
    const ctx = mockExecutionContext({ params: { id: 'ws-1' }, method: 'PUT', path: '/workspaces/ws-1' });
    await guard.canActivate(ctx);
    expect(permissionsServiceMock.check.mock.calls[0][0].actionType).toBe('write');
  });

  it('should map DELETE to act', async () => {
    permissionsServiceMock.check.mockResolvedValue(true);
    const ctx = mockExecutionContext({ params: { id: 'ws-1' }, method: 'DELETE', path: '/workspaces/ws-1' });
    await guard.canActivate(ctx);
    expect(permissionsServiceMock.check.mock.calls[0][0].actionType).toBe('act');
  });

  it('should default to unknown resource if path parts are insufficient', async () => {
    permissionsServiceMock.check.mockResolvedValue(true);
    const ctx = mockExecutionContext({ params: { id: 'ws-1' }, method: 'OPTIONS', path: '/test' });
    await guard.canActivate(ctx);
    expect(permissionsServiceMock.check.mock.calls[0][0].resource).toBe('unknown');
    expect(permissionsServiceMock.check.mock.calls[0][0].actionType).toBe('read');
  });
});
