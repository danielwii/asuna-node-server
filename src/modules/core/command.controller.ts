import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Hermes, InMemoryAsunaQueue } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { AnyAuthGuard } from './auth/auth.guard';

import type { AnyAuthRequest } from '../helper/interfaces';

const logger = LoggerFactory.getLogger('CommandController');

// TODO TDB...
export class CommandDTO {}

@ApiTags('core')
@Controller('api')
export class CommandController {
  @UseGuards(AnyAuthGuard)
  @Post('v1/commands')
  v1Commands(@Body() commandDto: CommandDTO, @Req() req: AnyAuthRequest): void {
    logger.log(`receive command ${r(commandDto)}`);
    const { identifier } = req;
    Hermes.emit('commands', 'commands', commandDto, { identifier });
  }
}
