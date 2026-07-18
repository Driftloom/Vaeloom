import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      document: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return documents for a workspace', async () => {
      const mockDocs = [{ id: 'doc-1', workspaceId: 'ws-1' }];
      prismaMock.document.findMany.mockResolvedValue(mockDocs);

      const result = await service.findAll('ws-1');

      expect(prismaMock.document.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockDocs);
    });
  });

  describe('enqueueUpload', () => {
    it('should create a document and return a jobId', async () => {
      const mockFile = { originalname: 'test.pdf', mimetype: 'application/pdf' };
      prismaMock.document.create.mockResolvedValue({ id: '123' });

      const result = await service.enqueueUpload('ws-1', mockFile);

      expect(prismaMock.document.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          path: 'test.pdf',
          rawStorageKey: 'storage://uploads/ws-1/test.pdf',
          type: 'application/pdf',
        },
      });
      expect(result).toEqual({ jobId: 'job-123' });
    });
  });
});
