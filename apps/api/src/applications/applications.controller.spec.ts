import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PermissionGuard } from '../common/guards/permission.guard';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: ApplicationsService;

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((workspaceId, dto) => Promise.resolve({ id: 'app1', workspaceId, ...dto })),
      findOne: jest.fn().mockResolvedValue({ id: 'app1', workspaceId: 'ws1' }),
      updateOutcome: jest.fn().mockResolvedValue({ id: 'app1', status: 'interview' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: mockService },
      ],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    service = module.get<ApplicationsService>(ApplicationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list applications', async () => {
    const result = await controller.list('ws1');
    expect(result).toEqual([]);
    expect(service.findAll).toHaveBeenCalledWith('ws1');
  });

  it('should create an application', async () => {
    const result = await controller.create('ws1', { company: 'Acme', status: 'APPLIED' });
    expect(result).toEqual({ id: 'app1', workspaceId: 'ws1', company: 'Acme', status: 'APPLIED' });
  });

  it('should update application outcome', async () => {
    const result = await controller.updateOutcome('ws1', 'app1', 'interview');
    expect(result).toEqual({ id: 'app1', status: 'interview' });
    expect(service.updateOutcome).toHaveBeenCalledWith('ws1', 'app1', 'interview');
  });
});
