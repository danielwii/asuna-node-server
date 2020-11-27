import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { EmailHelper } from './email.helper';

import type { MailAttachment } from './email.interface';

const logger = LoggerFactory.getLogger('EmailController');

class MailBody {
  @IsArray({ always: false })
  public to: string[];

  public cc: string[];

  public bcc: string[];

  @IsString()
  public subject: string;

  @IsString()
  public content: string;

  public attachments: MailAttachment[];
}

@ApiTags('core')
@Controller('api/email')
export class EmailController {
  @Post()
  public send(@Body() body: MailBody): void {
    logger.log(`send ${r(body)}`);

    EmailHelper.send(body)
      .then((value) => logger.log(`send mail done: ${r(value)}`))
      .catch((error) => logger.error(error));
  }
}
