import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflectorMock: any;
  let prismaMock: any;
  let contextMock: ExecutionContext;

  beforeEach(async () => {
    reflectorMock = {
      getAllAndOverride: jest.fn(),
    };

    prismaMock = {
      workspaceUser: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: reflectorMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);

    contextMock = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { id: 'user-1' },
          params: { workspaceId: 'ws-1' },
        }),
      }),
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if route is public', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    const result = await guard.canActivate(contextMock);
    expect(result).toBe(true);
  });

  it('should allow access if no roles are required', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [];
      return undefined;
    });

    const result = await guard.canActivate(contextMock);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user is not authenticated', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return ['ADMIN'];
      return false;
    });

    const requestWithoutUser = { user: null, params: { workspaceId: 'ws-1' } };
    (contextMock.switchToHttp().getRequest as jest.Mock).mockReturnValue(requestWithoutUser);

    await expect(guard.canActivate(contextMock)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(contextMock)).rejects.toMatchObject({
      message: 'No authenticated user',
    });
  });

  it('should throw ForbiddenException if workspace context is missing', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return ['ADMIN'];
      return false;
    });

    const requestWithoutWs = { user: { id: 'user-1' }, params: {} };
    (contextMock.switchToHttp().getRequest as jest.Mock).mockReturnValue(requestWithoutWs);

    await expect(guard.canActivate(contextMock)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user is not a member of the workspace', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return ['ADMIN'];
      return false;
    });
    prismaMock.workspaceUser.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextMock)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(contextMock)).rejects.toMatchObject({
      message: 'Not a member of this workspace',
    });
  });

  it('should throw ForbiddenException if user role is insufficient', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return ['ADMIN'];
      return false;
    });
    prismaMock.workspaceUser.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(guard.canActivate(contextMock)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(contextMock)).rejects.toMatchObject({
      message: 'Insufficient role permissions',
    });
  });

  it('should allow access if user has required role', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key) => {
      if (key === ROLES_KEY) return ['ADMIN', 'OWNER'];
      return false;
    });
    prismaMock.workspaceUser.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const result = await guard.canActivate(contextMock);
    expect(result).toBe(true);
  });
});
