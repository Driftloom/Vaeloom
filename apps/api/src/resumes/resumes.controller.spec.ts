import { Test, TestingModule } from '@nestjs/testing';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { PermissionGuard } from '../common/guards/permission.guard';

describe('ResumesController', () => {
  let controller: ResumesController;
  let service: ResumesService;

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn().mockResolvedValue([]),
      getMasterResume: jest.fn().mockResolvedValue({ id: 'res1', variantType: 'master' }),
      generateVariant: jest.fn().mockResolvedValue({ id: 'res2', variantType: 'tailored' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResumesController],
      providers: [
        { provide: ResumesService, useValue: mockService },
      ],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ResumesController>(ResumesController);
    service = module.get<ResumesService>(ResumesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list resumes', async () => {
    const result = await controller.list('ws1');
    expect(result).toEqual([]);
    expect(service.findAll).toHaveBeenCalledWith('ws1');
  });

  it('should get master resume', async () => {
    const result = await controller.getMaster('ws1');
    expect(result).toEqual({ id: 'res1', variantType: 'master' });
  });

  it('should generate a variant', async () => {
    const result = await controller.generateVariant('ws1', 'res1', { jobExternalId: '123' });
    expect(result).toEqual({ id: 'res2', variantType: 'tailored' });
    expect(service.generateVariant).toHaveBeenCalledWith('ws1', 'res1', { jobExternalId: '123' });
  });
});
