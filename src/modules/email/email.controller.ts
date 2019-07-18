import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import * as util from 'util';
import { r } from '../common/helpers';
import { EmailService } from './email.service';

const logger = new Logger('EmailController');

class MailBody {
  @IsArray({ always: false })
  to: string[];
  cc: string[];
  bcc: string[];
  @IsString()
  subject: string;
  @IsString()
  content: string;
  attachments: any[];
}

@ApiUseTags('core')
@Controller('api/email')
export class EmailController {
  constructor(private readonly mailService: EmailService) {}

  @Post()
  send(@Body() body: MailBody) {
    logger.log(`send ${util.inspect(body, { colors: true })}`);

    this.mailService
      .send(body)
      .then(value => logger.log(r(value)))
      .catch(reason => logger.warn(r(reason)));

    return;
  }
}
