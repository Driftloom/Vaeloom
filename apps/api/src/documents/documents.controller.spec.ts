import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PermissionGuard } from '../common/guards/permission.guard';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: DocumentsService;

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn().mockResolvedValue([]),
      enqueueUpload: jest.fn().mockResolvedValue({ jobId: 'job1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: mockService },
      ],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DocumentsController>(DocumentsController);
    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list documents', async () => {
    const result = await controller.list('ws1');
    expect(result).toEqual([]);
    expect(service.findAll).toHaveBeenCalledWith('ws1');
  });

  it('should enqueue upload', async () => {
    const result = await controller.upload('ws1', { originalname: 'test.pdf' } as any);
    expect(result).toEqual({ jobId: 'job1' });
    expect(service.enqueueUpload).toHaveBeenCalledWith('ws1', { originalname: 'test.pdf' });
  });
});
