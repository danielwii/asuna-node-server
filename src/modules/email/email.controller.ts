import { Body, Controller, Post } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { EmailService } from './email.service';

const logger = LoggerFactory.getLogger('EmailController');

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
    logger.log(`send ${r(body)}`);

    this.mailService
      .send(body)
      .then(value => logger.log(r(value)))
      .catch(error => logger.warn(r(error)));

    
  }
}
