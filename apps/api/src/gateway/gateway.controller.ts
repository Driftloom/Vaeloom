import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { GatewayService } from './gateway.service';

@ApiExcludeController()
@Controller()
export class GatewayController {
  constructor(private readonly gateway: GatewayService) {}

  @All('api/*')
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.gateway.forward(req, res);
  }
}
