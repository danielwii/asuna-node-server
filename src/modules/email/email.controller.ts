import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsArray, IsString } from 'class-validator';
import _ from 'lodash';
import { fileURLToPath } from 'node:url';

import { ContentfulService } from '../contentful';
import { EmailHelper } from './email.helper';
import { EmailService } from './email.service';

import type { MailAttachment } from './email.interface';

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
@Controller('api/v1/email')
export class EmailController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(private readonly emailService: EmailService, private readonly contentfulService: ContentfulService) {}

  @Post()
  public send(@Body() body: MailBody): void {
    this.logger.log(`send ${r(body)}`);

    EmailHelper.send(body)
      .then((value) => this.logger.log(`send mail done: ${r(value)}`))
      .catch((error) => this.logger.error(`send mail '${body.subject}' to ${r(body.to)} error`, error));
  }

  @Post('sendgrid')
  public async sendViaSendGrid(@Body() body) {
    this.logger.log(`sendgrid ${r(body)}`);
    const template = await this.contentfulService.getTemplates('verification-code.email-signup');

    this.logger.log(`content ${template}`);
    this.emailService
      .sendEmail(_.head(body.to), 'service@moment-minder.com', body.subject, template)
      .then((value) => this.logger.log(`send mail done: ${r(value)}`))
      .catch((error) => this.logger.error(`send mail '${body.subject}' to ${r(body.to)} error`, error));
  }
}
