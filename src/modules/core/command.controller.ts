import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'url';

import { AnyAuthGuard } from './auth/auth.guard';

import type { AnyAuthRequest } from '../helper/interfaces';

// TODO TDB...
export class CommandDTO {}

@ApiTags('core')
@Controller('api')
export class CommandController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), CommandController.name));
  @UseGuards(AnyAuthGuard)
  @Post('v1/commands')
  v1Commands(@Body() commandDto: CommandDTO, @Req() req: AnyAuthRequest): void {
    this.logger.log(`receive command ${r(commandDto)}`);
    const { identifier } = req;
    Hermes.emit('commands', 'commands', commandDto, { identifier });
  }
}
