import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Request } from 'express';

import { JwtAuthGuard } from '../core/auth';
import { AsunaCommand, CqrsService } from './cqrs.service';

const logger = new Logger('CqrsController');

class CommandDTO {
  @IsString()
  service: string;
  payload: any;
}

@ApiUseTags('core')
@Controller('api/v1/command')
export class CqrsController {
  constructor(private readonly cqrsService: CqrsService) {}

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }))
  @Post()
  async createCommand(@Body() dto: CommandDTO, @Req() req: Request) {
    const { user } = req as any;
    logger.log(`createCommand ${JSON.stringify(dto)}`);

    return this.cqrsService
      .handleCommand(new AsunaCommand({ service: dto.service, payload: dto.payload, user, req }))
      .catch(reason => logger.error(reason, reason.trace));
  }
}
