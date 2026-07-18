import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationChannel, SendNotificationDto } from './dto/notification.dto';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockDb = {
    query: jest.fn(),
    getPool: jest.fn(),
    onModuleDestroy: jest.fn(),
  };
  const mockConfigValues: Record<string, unknown> = {
    smtp: { host: 'localhost', port: 587, user: '', pass: '', from: 'n@n' },
    'slack.token': '',
    'slack.webhookUrl': '',
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

  const notification = {
    id: 'n1',
    channel: 'email',
    recipient: 'a@b.com',
    subject: 'Hi',
    body: 'Hello',
    status: 'sent',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
      ],
    }).compile();
    controller = module.get(NotificationController);
    service = module.get(NotificationService);

    // Stub delivery and subscriber notification to avoid external calls
    const srv = service as unknown as Record<string, jest.Mock>;
    srv['deliver'] = jest.fn().mockResolvedValue(undefined);
    srv['notifySubscribers'] = jest.fn().mockResolvedValue(undefined);
  });

  describe('send', () => {
    it('should send a notification', async () => {
      const dto: SendNotificationDto = {
        channel: NotificationChannel.EMAIL,
        recipient: 'a@b.com',
        subject: 'Hi',
        body: 'Hello',
      };
      mockDb.query.mockResolvedValue({ rows: [notification], rowCount: 1 });
      const result = await controller.send(dto);
      expect(result.status).toBe('sent');
    });

    it('should reject when no content and no template', async () => {
      const dto: SendNotificationDto = { channel: NotificationChannel.PUSH, recipient: 'tok' };
      await expect(controller.send(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('should return paginated notifications', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [notification] });
      const result = await controller.list({ page: 1, pageSize: 20, channel: NotificationChannel.EMAIL });
      expect(result.meta.total).toBe(1);
    });
  });

  describe('get', () => {
    it('should return a notification', async () => {
      mockDb.query.mockResolvedValue({ rows: [notification] });
      const result = await controller.get('n1');
      expect(result.id).toBe('n1');
    });

    it('should throw when missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(controller.get('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('templates', () => {
    it('should create a template', async () => {
      const tpl = { id: 't1', name: 'welcome', subject: 'Hi', body: 'Hello {{name}}', channel: 'email', created_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [tpl] });
      const result = await controller.createTemplate({ name: 'welcome', body: 'Hello {{name}}', channel: NotificationChannel.EMAIL });
      expect(result.id).toBe('t1');
    });

    it('should list templates', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await controller.listTemplates();
      expect(result).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('should register a subscriber', async () => {
      const sub = { id: 's1', url: 'https://h', tenant_id: null, created_at: new Date() };
      mockDb.query.mockResolvedValue({ rows: [sub] });
      const result = await controller.subscribe({ url: 'https://h' });
      expect(result.id).toBe('s1');
    });
  });

  describe('webhook receipt', () => {
    it('should record a receipt', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });
      const result = await controller.webhook('n1', { status: 'delivered' });
      expect(result).toEqual({ message: 'Receipt recorded' });
    });
  });
});
