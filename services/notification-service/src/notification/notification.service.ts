import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createTransport, type Transporter } from 'nodemailer';
import { WebClient } from '@slack/web-api';

import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  CreateTemplateDto,
  ListNotificationQueryDto,
  NotificationChannel,
  SendNotificationDto,
  SubscribeDto,
  WebhookReceiptDto,
} from './dto/notification.dto';

export interface NotificationRow {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateRow {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  channel: string;
  created_at: Date;
}

export interface SubscriberRow {
  id: string;
  url: string;
  tenant_id: string | null;
  created_at: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private emailTransport: Transporter;
  private slackClient: WebClient;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {
    const smtp = this.config.get<{
      host: string;
      port: number;
      user: string;
      pass: string;
      from: string;
    }>('smtp')!;
    this.emailTransport = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });

    const slackToken = this.config.get<string>('slack.token') as string;
    this.slackClient = new WebClient(slackToken);
  }

  async send(dto: SendNotificationDto): Promise<NotificationRow> {
    let subject = dto.subject ?? '';
    let body = dto.body ?? '';

    if (dto.template) {
      const tpl = await this.findTemplate(dto.template, dto.channel);
      subject = tpl.subject ?? subject;
      body = this.interpolate(tpl.body, dto.data ?? {});
    }

    if (!body && !subject) {
      throw new BadRequestException('Notification requires body, subject, or a template');
    }

    const id = randomUUID();
    const result = await this.db.query<NotificationRow>(
      `INSERT INTO notifications (id, channel, recipient, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [id, dto.channel, dto.recipient, subject, body],
    );
    const row = result.rows[0]!;

    try {
      await this.deliver(dto.channel, dto.recipient, subject, body);
      await this.markStatus(id, 'sent');
      row.status = 'sent';
    } catch (err) {
      this.logger.error({ err, id }, 'Notification delivery failed');
      await this.markStatus(id, 'failed');
      row.status = 'failed';
    }

    await this.notifySubscribers(row);
    return row;
  }

  private async deliver(channel: string, recipient: string, subject: string, body: string): Promise<void> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        await this.emailTransport.sendMail({
          from: this.config.get<string>('smtp.from'),
          to: recipient,
          subject,
          text: body,
        });
        break;
      case NotificationChannel.SLACK: {
        const webhook = this.config.get<string>('slack.webhookUrl');
        if (webhook) {
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: body, channel: recipient }),
          });
        } else {
          await this.slackClient.chat.postMessage({ channel: recipient, text: body });
        }
        break;
      }
      case NotificationChannel.PUSH: {
        await this.db.query(
          `INSERT INTO notification_device_tokens (token, payload) VALUES ($1, $2::jsonb)
           ON CONFLICT (token) DO UPDATE SET payload = EXCLUDED.payload`,
          [recipient, JSON.stringify({ subject, body })],
        );
        break;
      }
      default:
        throw new BadRequestException(`Unsupported channel: ${channel}`);
    }
  }

  async list(query: ListNotificationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (query.channel) {
      conditions.push(`channel = $${idx}`);
      params.push(query.channel);
      idx++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]!.count);
    const data = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );
    return { data: data.rows, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async get(id: string): Promise<NotificationRow> {
    const result = await this.db.query<NotificationRow>(
      `SELECT * FROM notifications WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Notification "${id}" not found`);
    }
    return result.rows[0]!;
  }

  async createTemplate(dto: CreateTemplateDto): Promise<TemplateRow> {
    const id = randomUUID();
    const result = await this.db.query<TemplateRow>(
      `INSERT INTO notification_templates (id, name, subject, body, channel)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, dto.name, dto.subject ?? null, dto.body, dto.channel],
    );
    return result.rows[0]!;
  }

  async listTemplates(): Promise<TemplateRow[]> {
    const result = await this.db.query<TemplateRow>(
      `SELECT * FROM notification_templates ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  async subscribe(dto: SubscribeDto): Promise<SubscriberRow> {
    const id = randomUUID();
    const result = await this.db.query<SubscriberRow>(
      `INSERT INTO notification_subscribers (id, url, tenant_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, dto.url, dto.tenantId ?? null],
    );
    return result.rows[0]!;
  }

  async receiveReceipt(id: string, dto: WebhookReceiptDto): Promise<void> {
    await this.markStatus(id, dto.status ?? 'unknown');
    this.logger.log({ id, status: dto.status }, 'Delivery receipt received');
  }

  private async findTemplate(name: string, channel: string): Promise<TemplateRow> {
    const result = await this.db.query<TemplateRow>(
      `SELECT * FROM notification_templates WHERE name = $1 AND channel = $2`,
      [name, channel],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Template "${name}" for channel "${channel}" not found`);
    }
    return result.rows[0]!;
  }

  private async markStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }

  private async notifySubscribers(notification: NotificationRow): Promise<void> {
    const subs = await this.db.query<SubscriberRow>(
      `SELECT * FROM notification_subscribers`,
    );
    await Promise.all(
      subs.rows.map((sub) =>
        fetch(sub.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification),
        }).catch((err) => this.logger.warn({ err, url: sub.url }, 'Subscriber webhook failed')),
      ),
    );
  }

  private interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
      const value = data[key];
      return value !== undefined ? String(value) : match;
    });
  }
}
