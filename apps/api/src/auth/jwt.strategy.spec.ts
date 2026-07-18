import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '@vaeloom/shared-types';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
    };

    configServiceMock = {
      get: jest.fn().mockReturnValue('mock-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: configServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user details if user exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        iat: 123,
        exp: 456,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({ id: 'user-1', email: 'test@example.com' });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        iat: 123,
        exp: 456,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
