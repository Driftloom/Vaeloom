import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalAiService {
  private readonly logger = new Logger(InternalAiService.name);
  private readonly aiServiceUrl: string;
  private readonly aiServiceSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
    this.aiServiceSecret = this.configService.get<string>('INTERNAL_SERVICE_SECRET') || 'dev-secret';
  }

  /**
   * Proxies a chat message to the AI orchestrator.
   */
  async sendChatMessage(workspaceId: string, message: string, agentName?: string): Promise<any> {
    const url = `${this.aiServiceUrl}/api/v1/orchestrator/chat`;
    const payload = {
      workspaceId,
      message,
      agentName,
    };

    return this.postRequest(url, payload);
  }

  /**
   * Generates a resume variant by delegating to the AI service.
   */
  async generateResumeVariant(workspaceId: string, resumeId: string, parameters: any): Promise<any> {
    const url = `${this.aiServiceUrl}/api/v1/agents/resume/generate`;
    const payload = {
      workspaceId,
      resumeId,
      parameters,
    };

    return this.postRequest(url, payload);
  }

  private async postRequest(url: string, payload: any): Promise<any> {
    try {
      this.logger.debug(`Sending internal request to ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-secret': this.aiServiceSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`AI service responded with ${response.status}: ${errorText}`);
        throw new HttpException(`AI Service Error: ${errorText}`, response.status);
      }

      return await response.json();
    } catch (error: any) {
      this.logger.error(`Failed to connect to AI service: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal AI Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
