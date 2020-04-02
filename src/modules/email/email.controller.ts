import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { EmailHelper } from './email.helper';
import { MailAttachment } from './email.interface';

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

  attachments: MailAttachment[];
}

@ApiTags('core')
@Controller('api/email')
export class EmailController {
  @Post()
  send(@Body() body: MailBody): void {
    logger.log(`send ${r(body)}`);

    EmailHelper.send(body)
      .then((value) => logger.log(`send mail done: ${r(value)}`))
      .catch((error) => logger.error(`send mail error: ${r(error)}`));
  }
}
