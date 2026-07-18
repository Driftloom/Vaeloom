import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { InternalAiService } from '../common/services/internal-ai.service';
import { PermissionGuard } from '../common/guards/permission.guard';

describe('ChatController', () => {
  let controller: ChatController;
  let service: InternalAiService;

  beforeEach(async () => {
    const mockService = {
      sendChatMessage: jest.fn().mockResolvedValue({ response: 'hello from AI' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: InternalAiService, useValue: mockService },
      ],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<InternalAiService>(InternalAiService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should send a chat message', async () => {
    const result = await controller.sendMessage('ws1', 'Hi');
    expect(result).toEqual({ response: 'hello from AI' });
    expect(service.sendChatMessage).toHaveBeenCalledWith('ws1', 'Hi', undefined);
  });

  it('should send a chat message with agentName', async () => {
    await controller.sendMessage('ws1', 'Hi', 'agent1');
    expect(service.sendChatMessage).toHaveBeenCalledWith('ws1', 'Hi', 'agent1');
  });
});
