import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { AnyAuthGuard } from './auth/auth.guard';

import type { AnyAuthRequest } from '../helper/interfaces';

const logger = new Logger(resolveModule(__filename, 'CommandController'));

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
