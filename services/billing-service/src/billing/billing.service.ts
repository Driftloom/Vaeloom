import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  CreateSubscriptionDto,
  GenerateInvoiceDto,
  ListInvoiceQueryDto,
  ListUsageQueryDto,
  RecordUsageDto,
  SubscriptionPlan,
  UpdateSubscriptionDto,
} from './dto/billing.dto';

export interface SubscriptionRow {
  id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tenant_id: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UsageRow {
  id: string;
  metric: string;
  value: number;
  tenant_id: string;
  recorded_at: Date;
}

export interface InvoiceRow {
  id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  period_start: Date | null;
  period_end: Date | null;
  line_items: string;
  created_at: Date;
}

const PLAN_UNIT_CENTS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.STARTER]: 1900,
  [SubscriptionPlan.PRO]: 4900,
  [SubscriptionPlan.ENTERPRISE]: 19900,
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('stripe.secretKey') as string, {
      apiVersion: '2024-06-20',
    });
  }

  async createSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionRow> {
    const customer = await this.stripe.customers.create({
      metadata: { tenantId: dto.tenantId },
    });

    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: this.priceIdForPlan(dto.plan) }],
      metadata: { tenantId: dto.tenantId },
    });

    const periodStart = new Date((subscription as unknown as { current_period_start: number }).current_period_start * 1000);
    const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000);

    const result = await this.db.query<SubscriptionRow>(
      `INSERT INTO billing_subscriptions
        (plan, status, stripe_customer_id, stripe_subscription_id, tenant_id, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dto.plan,
        subscription.status,
        customer.id,
        subscription.id,
        dto.tenantId,
        periodStart,
        periodEnd,
      ],
    );

    this.logger.log({ tenantId: dto.tenantId, plan: dto.plan }, 'Subscription created');
    return result.rows[0]!;
  }

  async getSubscription(id: string): Promise<SubscriptionRow> {
    const result = await this.db.query<SubscriptionRow>(
      `SELECT * FROM billing_subscriptions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Subscription "${id}" not found`);
    }
    return result.rows[0]!;
  }

  async updateSubscription(id: string, dto: UpdateSubscriptionDto): Promise<SubscriptionRow> {
    const existing = await this.getSubscription(id);

    if (dto.cancel) {
      if (existing.stripe_subscription_id) {
        await this.stripe.subscriptions.cancel(existing.stripe_subscription_id);
      }
      const result = await this.db.query<SubscriptionRow>(
        `UPDATE billing_subscriptions SET status = 'canceled', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id],
      );
      return result.rows[0]!;
    }

    if (dto.plan && dto.plan !== existing.plan) {
      if (existing.stripe_subscription_id) {
        const subscription = await this.stripe.subscriptions.retrieve(existing.stripe_subscription_id);
        const itemId = (subscription as unknown as { items: { data: Array<{ id: string }> } }).items.data[0]?.id;
        if (itemId) {
          await this.stripe.subscriptionItems.update(itemId, {
            price: this.priceIdForPlan(dto.plan),
          });
        }
      }
      const result = await this.db.query<SubscriptionRow>(
        `UPDATE billing_subscriptions SET plan = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [dto.plan, id],
      );
      return result.rows[0]!;
    }

    return existing;
  }

  async recordUsage(dto: RecordUsageDto): Promise<UsageRow> {
    const value = Number(dto.value);
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('value must be a non-negative number');
    }

    const result = await this.db.query<UsageRow>(
      `INSERT INTO billing_usage (metric, value, tenant_id) VALUES ($1, $2, $3) RETURNING *`,
      [dto.metric, value, dto.tenantId],
    );
    this.logger.log({ tenantId: dto.tenantId, metric: dto.metric, value }, 'Usage recorded');
    return result.rows[0]!;
  }

  async listUsage(query: ListUsageQueryDto): Promise<{ data: UsageRow[]; meta: Record<string, unknown> }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.metric) {
      conditions.push(`metric = $${idx}`);
      params.push(query.metric);
      idx++;
    }
    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx}`);
      params.push(query.tenantId);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM billing_usage ${where}`,
      params,
    );
    const total = Number(count.rows[0]!.count);

    const data = await this.db.query<UsageRow>(
      `SELECT * FROM billing_usage ${where} ORDER BY recorded_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    return {
      data: data.rows,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async generateInvoice(dto: GenerateInvoiceDto): Promise<InvoiceRow> {
    const planRes = await this.db.query<{ plan: string }>(
      `SELECT plan FROM billing_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [dto.tenantId],
    );
    const plan = (planRes.rows[0]?.plan ?? SubscriptionPlan.FREE) as SubscriptionPlan;

    const usageRes = await this.db.query<{ metric: string; total: string }>(
      `SELECT metric, SUM(value) as total FROM billing_usage
       WHERE tenant_id = $1
         AND ($2::timestamptz IS NULL OR recorded_at >= $2::timestamptz)
         AND ($3::timestamptz IS NULL OR recorded_at <= $3::timestamptz)
       GROUP BY metric`,
      [dto.tenantId, dto.periodStart ?? null, dto.periodEnd ?? null],
    );

    const lineItems: Array<Record<string, unknown>> = [];
    let amountCents = PLAN_UNIT_CENTS[plan];

    lineItems.push({ description: `Plan: ${plan}`, amountCents: PLAN_UNIT_CENTS[plan] });

    for (const row of usageRes.rows) {
      const usageAmount = Number(row.total) * 1;
      amountCents += usageAmount;
      lineItems.push({ description: `Usage: ${row.metric}`, units: Number(row.total), amountCents: usageAmount });
    }

    const result = await this.db.query<InvoiceRow>(
      `INSERT INTO billing_invoices
        (tenant_id, amount_cents, currency, status, period_start, period_end, line_items)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        dto.tenantId,
        amountCents,
        'usd',
        'draft',
        dto.periodStart ? new Date(dto.periodStart) : null,
        dto.periodEnd ? new Date(dto.periodEnd) : null,
        JSON.stringify(lineItems),
      ],
    );

    this.logger.log({ tenantId: dto.tenantId, amountCents }, 'Invoice generated');
    return result.rows[0]!;
  }

  async listInvoices(query: ListInvoiceQueryDto): Promise<{ data: InvoiceRow[]; meta: Record<string, unknown> }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx}`);
      params.push(query.tenantId);
      idx++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM billing_invoices ${where}`,
      params,
    );
    const total = Number(count.rows[0]!.count);
    const data = await this.db.query<InvoiceRow>(
      `SELECT * FROM billing_invoices ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );
    return { data: data.rows, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ received: boolean }> {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret') as string;
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature ?? '', webhookSecret);
    } catch (err) {
      this.logger.warn({ err }, 'Stripe webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'invoice.paid':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as unknown as { id: string; status?: string };
        if (subscription.id) {
          await this.db.query(
            `UPDATE billing_subscriptions SET status = $1, updated_at = NOW()
             WHERE stripe_subscription_id = $2`,
            [subscription.status ?? 'active', subscription.id],
          );
        }
        break;
      }
      default:
        break;
    }

    this.logger.log({ type: event.type }, 'Stripe webhook handled');
    return { received: true };
  }

  private priceIdForPlan(plan: SubscriptionPlan): string {
    const envKey = `STRIPE_PRICE_${plan.toUpperCase()}`;
    const priceId = process.env[envKey];
    if (!priceId) {
      throw new BadRequestException(`No Stripe price configured for plan "${plan}"`);
    }
    return priceId;
  }
}
