import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Subscription, UsageRecord } from '../generated/prisma';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(tenantId: string, metric?: string, from?: string, to?: string): Promise<UsageRecord[]> {
    const where: Record<string, unknown> = { tenantId };
    if (metric) where['metric'] = metric;
    if (from || to) {
      where['timestamp'] = {};
      if (from) (where['timestamp'] as Record<string, unknown>)['gte'] = new Date(from);
      if (to) (where['timestamp'] as Record<string, unknown>)['lte'] = new Date(to);
    }
    return this.prisma.usageRecord.findMany({ where, orderBy: { timestamp: 'desc' }, take: 100 });
  }

  async getSubscription(tenantId: string): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('No subscription found for this tenant');
    return sub;
  }

  async createSubscription(tenantId: string, plan: string): Promise<Subscription> {
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    return this.prisma.subscription.upsert({
      where: { tenantId },
      update: { plan, currentPeriodEnd, status: 'active' },
      create: { tenantId, plan, currentPeriodEnd, status: 'active' },
    });
  }
}
