import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

describe('EventsService', () => {
  let service: EventsService;
  let httpMock: any;

  beforeEach(async () => {
    httpMock = {
      request: jest.fn(),
    };

    const configMock = {
      get: jest.fn().mockReturnValue('http://mock:8200'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: HttpService, useValue: httpMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should post event to eventbus', async () => {
      httpMock.request.mockReturnValue(of({ data: { id: 'evt-1' } }));
      const result = await service.publish({ type: 'TEST' }, 't-1');
      expect(result).toEqual({ id: 'evt-1' });
      expect(httpMock.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        url: 'http://mock:8200/events',
        data: { type: 'TEST', tenantId: 't-1' },
      }));
    });
  });

  describe('findAll', () => {
    it('should get events from eventbus', async () => {
      httpMock.request.mockReturnValue(of({ data: { data: [{ id: 'evt-1' }], meta: {} } }));
      const result = await service.findAll('t-1');
      expect(result.data[0].id).toBe('evt-1');
      expect(httpMock.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'GET',
        url: 'http://mock:8200/events',
        params: { tenantId: 't-1' },
      }));
    });
  });

  describe('createSubscription', () => {
    it('should post subscription', async () => {
      httpMock.request.mockReturnValue(of({ data: { id: 'sub-1' } }));
      const result = await service.createSubscription({ endpoint: 'http://test' }, 't-1');
      expect(result.id).toBe('sub-1');
    });
  });

  describe('listSubscriptions', () => {
    it('should get subscriptions', async () => {
      httpMock.request.mockReturnValue(of({ data: { data: [{ id: 'sub-1' }] } }));
      const result = await service.listSubscriptions('t-1');
      expect(result.data[0].id).toBe('sub-1');
    });
  });
});
