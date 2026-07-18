import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('BillingService', () => {
  let service: BillingService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      usageRecord: {
        findMany: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsage', () => {
    it('should query usage with all parameters', async () => {
      prismaMock.usageRecord.findMany.mockResolvedValue([]);
      
      const from = '2026-01-01T00:00:00Z';
      const to = '2026-01-31T00:00:00Z';
      await service.getUsage('t-1', 'api_calls', from, to);

      expect(prismaMock.usageRecord.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 't-1',
          metric: 'api_calls',
          timestamp: {
            gte: new Date(from),
            lte: new Date(to),
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should query usage with minimal parameters', async () => {
      prismaMock.usageRecord.findMany.mockResolvedValue([]);
      
      await service.getUsage('t-1');

      expect(prismaMock.usageRecord.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't-1' },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });
  });

  describe('getSubscription', () => {
    it('should return subscription if found', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({ plan: 'pro' });
      const result = await service.getSubscription('t-1');
      expect(result).toEqual({ plan: 'pro' });
    });

    it('should throw NotFoundException if not found', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      await expect(service.getSubscription('t-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSubscription', () => {
    it('should upsert subscription', async () => {
      prismaMock.subscription.upsert.mockResolvedValue({ plan: 'pro' });
      const result = await service.createSubscription('t-1', 'pro');
      expect(result).toEqual({ plan: 'pro' });
      expect(prismaMock.subscription.upsert).toHaveBeenCalledWith({
        where: { tenantId: 't-1' },
        update: expect.objectContaining({ plan: 'pro', status: 'active' }),
        create: expect.objectContaining({ tenantId: 't-1', plan: 'pro', status: 'active' }),
      });
    });
  });
});
