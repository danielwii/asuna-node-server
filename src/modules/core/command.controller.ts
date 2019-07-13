import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { r } from '../common/helpers';
import { AnyAuthGuard, AnyAuthRequest } from './auth';
import { Hermes } from './bus';

const logger = new Logger('CommandController');

// TODO TDB...
export class CommandDTO {}

@ApiUseTags('core')
@Controller('api')
export class CommandController {
  @UseGuards(AnyAuthGuard)
  @Post('v1/commands')
  v1Commands(@Body() commandDto: CommandDTO, @Req() req: AnyAuthRequest) {
    logger.log(`receive command ${r(commandDto)}`);
    const { identifier } = req;
    Hermes.emit('commands', 'commands', commandDto, { identifier });
  }
}
