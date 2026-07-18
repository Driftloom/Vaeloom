import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuthedUser } from '../auth/jwt.strategy';

describe('BillingController', () => {
  let controller: BillingController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      getUsage: jest.fn(),
      getSubscription: jest.fn(),
      createSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsage', () => {
    it('should call getUsage on service', async () => {
      serviceMock.getUsage.mockResolvedValue([]);
      const user: AuthedUser = { id: 'user-1', email: 'test@test.com' };
      const result = await controller.getUsage(user, { metric: 'm1' });
      expect(result).toEqual([]);
      expect(serviceMock.getUsage).toHaveBeenCalledWith('user-1', 'm1', undefined, undefined);
    });
  });

  describe('getSubscription', () => {
    it('should call getSubscription on service', async () => {
      serviceMock.getSubscription.mockResolvedValue({ plan: 'pro' });
      const user: AuthedUser = { id: 'user-1', email: 'test@test.com' };
      const result = await controller.getSubscription(user);
      expect(result).toEqual({ plan: 'pro' });
      expect(serviceMock.getSubscription).toHaveBeenCalledWith('user-1');
    });
  });

  describe('createSubscription', () => {
    it('should call createSubscription on service', async () => {
      serviceMock.createSubscription.mockResolvedValue({ plan: 'pro' });
      const user: AuthedUser = { id: 'user-1', email: 'test@test.com' };
      const result = await controller.createSubscription(user, { plan: 'pro' });
      expect(result).toEqual({ plan: 'pro' });
      expect(serviceMock.createSubscription).toHaveBeenCalledWith('user-1', 'pro');
    });
  });
});
