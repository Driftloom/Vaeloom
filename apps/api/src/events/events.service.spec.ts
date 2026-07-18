import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { ConfigService } from '@nestjs/config';

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const configMock = {
      get: jest.fn().mockReturnValue('redis://localhost:6379/0'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should add event to queue', async () => {
      const result = await service.publish({ type: 'TEST', source: 'test', category: 'test', payload: {} }, 't-1');
      expect(result).toBeDefined();
      expect(result.type).toBe('TEST');
    });
  });

  describe('findAll', () => {
    it('should return paginated response', async () => {
      const result = await service.findAll('t-1');
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });
  });

  describe('createSubscription', () => {
    it('should add subscription to queue', async () => {
      const result = await service.createSubscription({ eventType: 'test', handlerId: 'h-1', handlerType: 'webhook' }, 't-1');
      expect(result).toBeDefined();
      expect(result.eventType).toBe('test');
    });
  });

  describe('listSubscriptions', () => {
    it('should return empty list', async () => {
      const result = await service.listSubscriptions('t-1');
      expect(result.data).toEqual([]);
    });
  });
});
