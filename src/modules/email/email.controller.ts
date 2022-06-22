import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsArray, IsString } from 'class-validator';

import { EmailHelper } from './email.helper';

import type { MailAttachment } from './email.interface';

const logger = new Logger(resolveModule(__filename, 'EmailController'));

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
  public send(@Body() body: MailBody): void {
    logger.log(`send ${r(body)}`);

    EmailHelper.send(body)
      .then((value) => logger.log(`send mail done: ${r(value)}`))
      .catch((error) => logger.error(error));
  }
}
