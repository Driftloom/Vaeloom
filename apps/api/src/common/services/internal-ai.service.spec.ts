import { Test, TestingModule } from '@nestjs/testing';
import { InternalAiService } from './internal-ai.service';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('InternalAiService', () => {
  let service: InternalAiService;
  let configServiceMock: any;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    configServiceMock = {
      get: jest.fn((key) => {
        if (key === 'AI_SERVICE_URL') return 'http://mock-ai:8000';
        if (key === 'INTERNAL_SERVICE_SECRET') return 'mock-secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalAiService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<InternalAiService>(InternalAiService);
    
    // Mock global fetch
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendChatMessage', () => {
    it('should send POST request and return data', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ reply: 'hello' }),
      });

      const result = await service.sendChatMessage('ws-1', 'hi there', 'agent-1');

      expect(result).toEqual({ reply: 'hello' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://mock-ai:8000/api/v1/orchestrator/chat',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-secret': 'mock-secret',
          },
          body: JSON.stringify({
            workspaceId: 'ws-1',
            message: 'hi there',
            agentName: 'agent-1',
          }),
        })
      );
    });

    it('should throw HttpException if response is not ok', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(service.sendChatMessage('ws-1', 'hi')).rejects.toThrow(HttpException);
      await expect(service.sendChatMessage('ws-1', 'hi')).rejects.toMatchObject({
        status: 400,
        message: 'AI Service Error: Bad Request',
      });
    });

    it('should throw SERVICE_UNAVAILABLE if fetch throws an error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(service.sendChatMessage('ws-1', 'hi')).rejects.toThrow(HttpException);
      await expect(service.sendChatMessage('ws-1', 'hi')).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Internal AI Service unavailable',
      });
    });
  });

  describe('generateResumeVariant', () => {
    it('should send POST request and return data', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await service.generateResumeVariant('ws-1', 'res-1', { format: 'pdf' });

      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://mock-ai:8000/api/v1/agents/resume/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            workspaceId: 'ws-1',
            resumeId: 'res-1',
            parameters: { format: 'pdf' },
          }),
        })
      );
    });
  });
});
