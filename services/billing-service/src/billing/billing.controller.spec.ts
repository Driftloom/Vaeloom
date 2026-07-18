import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import {
  CreateSubscriptionDto,
  RecordUsageDto,
  SubscriptionPlan,
} from './dto/billing.dto';

describe('BillingController', () => {
  let controller: BillingController;
  let service: BillingService;

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockConfigValues: Record<string, unknown> = {
    'stripe.secretKey': 'sk_test_xxx',
    'stripe.webhookSecret': 'whsec_test',
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as unknown as ConfigService;
  const mockRequestContext = {
    correlationId: 'cid',
    tenantId: 'default',
    userId: undefined,
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };

  const subscription = {
    id: 'sub-1',
    plan: 'starter',
    status: 'active',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_stripe_1',
    tenant_id: 't1',
    current_period_start: new Date(),
    current_period_end: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_PRICE_STARTER = 'price_starter';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();

    controller = module.get(BillingController);
    service = module.get(BillingService);

    // Stub the Stripe client methods
    const srv = service as unknown as { stripe: any };
    srv.stripe = {
      customers: { create: jest.fn().mockResolvedValue({ id: 'cus_1' }) },
      subscriptions: {
        create: jest.fn().mockResolvedValue({
          id: 'sub_stripe_1',
          status: 'active',
          current_period_start: 1700000000,
          current_period_end: 1702600000,
        }),
        retrieve: jest.fn().mockResolvedValue({ items: { data: [{ id: 'si_1' }] } }),
        cancel: jest.fn().mockResolvedValue({ id: 'sub_stripe_1' }),
      },
      subscriptionItems: { update: jest.fn().mockResolvedValue({}) },
      webhooks: { constructEvent: jest.fn() },
    };
  });

  describe('createSubscription', () => {
    it('should create a subscription via Stripe', async () => {
      const dto: CreateSubscriptionDto = { plan: SubscriptionPlan.STARTER, tenantId: 't1' };
      mockDb.query.mockResolvedValue({ rows: [subscription] });

      const result = await controller.createSubscription(dto);
      expect(result).toEqual(subscription);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO billing_subscriptions'),
        expect.arrayContaining(['starter', 't1']),
      );
    });
  });

  describe('getSubscription', () => {
    it('should return a subscription', async () => {
      mockDb.query.mockResolvedValue({ rows: [subscription] });
      const result = await controller.getSubscription('sub-1');
      expect(result).toEqual(subscription);
    });

    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(controller.getSubscription('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateSubscription', () => {
    it('should cancel a subscription', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [subscription] })
        .mockResolvedValueOnce({ rows: [{ ...subscription, status: 'canceled' }] });
      const result = await controller.updateSubscription('sub-1', { cancel: true });
      expect(result.status).toBe('canceled');
    });
  });

  describe('recordUsage', () => {
    it('should record usage', async () => {
      const dto: RecordUsageDto = { metric: 'api_calls', value: 10, tenantId: 't1' };
      const usage = { id: 'u1', metric: 'api_calls', value: 10, tenant_id: 't1', recorded_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [usage] });
      const result = await controller.recordUsage(dto);
      expect(result).toEqual(usage);
    });

    it('should reject negative usage', async () => {
      const dto: RecordUsageDto = { metric: 'api_calls', value: -5, tenantId: 't1' };
      await expect(controller.recordUsage(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listUsage', () => {
    it('should return paginated usage', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await controller.listUsage({ page: 1, pageSize: 20, tenantId: 't1' });
      expect(result.meta.total).toBe(2);
    });
  });

  describe('generateInvoice', () => {
    it('should generate an invoice from usage and plan', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ plan: 'starter' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'inv-1',
              tenant_id: 't1',
              amount_cents: 1900,
              currency: 'usd',
              status: 'draft',
              period_start: null,
              period_end: null,
              line_items: '[]',
              created_at: new Date(),
            },
          ],
        });
      const result = await controller.generateInvoice({ tenantId: 't1' });
      expect(result.amount_cents).toBe(1900);
    });
  });

  describe('handleStripeWebhook', () => {
    it('should verify signature and handle event', async () => {
      const srv = service as unknown as { stripe: any };
      srv.stripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_stripe_1', status: 'active' } },
      });
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const req = { rawBody: Buffer.from('{}'), headers: { 'stripe-signature': 'sig' } } as never;
      const result = await controller.stripeWebhook(req);
      expect(result.received).toBe(true);
    });
  });
});
