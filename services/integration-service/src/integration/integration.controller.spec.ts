import { HttpService } from '@nestjs/axios';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { of } from 'rxjs';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from '../observability/request-context.service';
import { CryptoService } from './crypto.service';
import {
  ConnectIntegrationDto,
  IntegrationProvider,
} from './dto/connect-integration.dto';
import type { QueryIntegrationDto } from './dto/query-integration.dto';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';

describe('IntegrationController', () => {
  let controller: IntegrationController;
  let crypto: CryptoService;

  const mockIntegration = {
    id: '44444444-4444-4444-4444-444444444444',
    provider: 'slack',
    status: 'CONNECTED',
    tenant_id: 'default',
    external_account_id: null,
    encrypted_token: 'enc',
    metadata: '{}',
    last_sync_at: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockDb = { query: jest.fn(), getPool: jest.fn(), onModuleDestroy: jest.fn() };
  const mockHttp = { get: jest.fn(), post: jest.fn() };
  const mockConfigValues: Record<string, unknown> = {
    'integration.encryptionKey': 'a'.repeat(32),
    'integration.eventBusUrl': 'http://event-bus:3040',
    'integration.slackSigningSecret': '',
    'integration.githubWebhookSecret': '',
  };
  const mockConfig = { get: (key: string) => mockConfigValues[key] } as ConfigService;
  const mockRequestContext = {
    correlationId: 'test',
    userId: undefined,
    tenantId: 'default',
    getStore: jest.fn(),
    run: jest.fn(),
    setPrincipal: jest.fn(),
  };
  const mockMetrics = { recordEvent: jest.fn(), recordHttpRequest: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationController],
      providers: [
        IntegrationService,
        CryptoService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: HttpService, useValue: mockHttp },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestContextService, useValue: mockRequestContext },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    controller = module.get<IntegrationController>(IntegrationController);
    crypto = module.get<CryptoService>(CryptoService);
    mockHttp.post.mockReturnValue(of({ data: { access_token: 'abc' } }));
  });

  describe('crypto', () => {
    it('should round-trip encrypt/decrypt (AES-256-GCM)', () => {
      const enc = crypto.encrypt('super-secret-token');
      expect(enc).not.toBe('super-secret-token');
      expect(crypto.decrypt(enc)).toBe('super-secret-token');
    });
  });

  describe('connect', () => {
    it('should connect with a direct token and store it encrypted', async () => {
      const dto: ConnectIntegrationDto = {
        provider: IntegrationProvider.SLACK,
        token: 'my-token',
      };
      mockDb.query.mockResolvedValue({ rows: [mockIntegration] });

      const result = await controller.connect(dto);
      expect(result).toEqual(mockIntegration);
      const args = mockDb.query.mock.calls[0]![1] as unknown[];
      expect(args).not.toContain('my-token');
    });

    it('should exchange an oauth code for a token', async () => {
      const dto: ConnectIntegrationDto = {
        provider: IntegrationProvider.GITHUB,
        oauthCode: 'code-123',
      };
      mockDb.query.mockResolvedValue({ rows: [mockIntegration] });

      const result = await controller.connect(dto);
      expect(result).toEqual(mockIntegration);
      expect(mockHttp.post).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated integrations', async () => {
      const query: QueryIntegrationDto = { page: 1, pageSize: 20 };
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockIntegration] });

      const result = await controller.findAll(query);
      expect(result.data).toEqual([mockIntegration]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when missing', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await expect(controller.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and revoke', async () => {
      const enc = crypto.encrypt('token');
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ ...mockIntegration, encrypted_token: enc }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await controller.disconnect(mockIntegration.id);
      expect(result).toEqual({ message: 'Integration disconnected successfully' });
    });
  });

  describe('webhook', () => {
    it('should accept a webhook when no signing secret configured', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockIntegration] });

      const result = await controller.webhook(
        mockIntegration.id,
        { event: 'message' },
        undefined,
        undefined,
        undefined,
        {} as Request,
      );
      expect(result).toEqual({ received: true });
    });

    it('should reject a webhook with bad signature when secret set', async () => {
      mockConfigValues['integration.slackSigningSecret'] = 'sekret';
      mockDb.query.mockResolvedValue({ rows: [mockIntegration] });

      await expect(
        controller.webhook(
          mockIntegration.id,
          { event: 'message' },
          undefined,
          undefined,
          'v0=bad',
          {} as Request,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      mockConfigValues['integration.slackSigningSecret'] = '';
    });
  });

  describe('sync', () => {
    it('should trigger a sync', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockIntegration] })
        .mockResolvedValueOnce({ rows: [{ ...mockIntegration, last_sync_at: new Date() }] });

      const result = await controller.sync(mockIntegration.id);
      expect(result.status).toBe('SYNC_STARTED');
    });
  });
});
