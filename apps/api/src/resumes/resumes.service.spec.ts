import { Test, TestingModule } from '@nestjs/testing';
import { ResumesService } from './resumes.service';
import { PrismaService } from '../prisma/prisma.service';
import { InternalAiService } from '../common/services/internal-ai.service';
import { NotFoundException } from '@nestjs/common';

describe('ResumesService', () => {
  let service: ResumesService;
  let prismaMock: any;
  let aiServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      resume: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    aiServiceMock = {
      generateResumeVariant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InternalAiService, useValue: aiServiceMock },
      ],
    }).compile();

    service = module.get<ResumesService>(ResumesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all resumes for a workspace', async () => {
      const mockResumes = [{ id: 'res-1' }];
      prismaMock.resume.findMany.mockResolvedValue(mockResumes);

      const result = await service.findAll('ws-1');
      expect(result).toEqual(mockResumes);
      expect(prismaMock.resume.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getMasterResume', () => {
    it('should return master resume if found', async () => {
      const mockResume = { id: 'res-master', variantType: 'master' };
      prismaMock.resume.findFirst.mockResolvedValue(mockResume);

      const result = await service.getMasterResume('ws-1');
      expect(result).toEqual(mockResume);
      expect(prismaMock.resume.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', variantType: 'master' },
      });
    });

    it('should throw NotFoundException if master resume not found', async () => {
      prismaMock.resume.findFirst.mockResolvedValue(null);
      await expect(service.getMasterResume('ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateVariant', () => {
    it('should call ai service', async () => {
      aiServiceMock.generateResumeVariant.mockResolvedValue({ success: true });

      const result = await service.generateVariant('ws-1', 'res-1', { param: 'x' });
      expect(result).toEqual({ success: true });
      expect(aiServiceMock.generateResumeVariant).toHaveBeenCalledWith('ws-1', 'res-1', { param: 'x' });
    });
  });
});
