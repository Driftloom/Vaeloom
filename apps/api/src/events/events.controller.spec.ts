import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

describe('EventsController', () => {
  let controller: EventsController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      publish: jest.fn(),
      findAll: jest.fn(),
      createSubscription: jest.fn(),
      listSubscriptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('publish', () => {
    it('should call publish on service', async () => {
      serviceMock.publish.mockResolvedValue({ id: 'evt-1' });
      const result = await controller.publish({ id: 'u-1', email: 'test@t.com' }, { topic: 'test' } as any);
      expect(result.id).toBe('evt-1');
      expect(serviceMock.publish).toHaveBeenCalledWith({ topic: 'test' }, 'u-1');
    });
  });

  describe('findAll', () => {
    it('should call findAll on service', async () => {
      serviceMock.findAll.mockResolvedValue({ data: [] });
      const result = await controller.findAll({ id: 'u-1', email: 'test@t.com' });
      expect(result.data).toEqual([]);
      expect(serviceMock.findAll).toHaveBeenCalledWith('u-1');
    });
  });

  describe('createSubscription', () => {
    it('should call createSubscription on service', async () => {
      serviceMock.createSubscription.mockResolvedValue({ id: 'sub-1' });
      const result = await controller.createSubscription({ id: 'u-1', email: 'test@t.com' }, { endpoint: 'x' } as any);
      expect(result.id).toBe('sub-1');
      expect(serviceMock.createSubscription).toHaveBeenCalledWith({ endpoint: 'x' }, 'u-1');
    });
  });

  describe('listSubscriptions', () => {
    it('should call listSubscriptions on service', async () => {
      serviceMock.listSubscriptions.mockResolvedValue({ data: [] });
      const result = await controller.listSubscriptions({ id: 'u-1', email: 'test@t.com' });
      expect(result.data).toEqual([]);
      expect(serviceMock.listSubscriptions).toHaveBeenCalledWith('u-1');
    });
  });
});
