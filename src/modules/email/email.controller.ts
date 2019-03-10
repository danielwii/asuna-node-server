import { Body, Controller, Logger, Post } from '@nestjs/common';
import { IsArray, IsString } from 'class-validator';
import * as util from 'util';
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

@Controller('api/email')
export class EmailController {
  constructor(private readonly mailService: EmailService) {}

  @Post()
  send(@Body() body: MailBody) {
    logger.log(`send ${util.inspect(body, { colors: true })}`);

    this.mailService
      .send(body)
      .then(console.log)
      .catch(console.error);

    return;
  }
}
