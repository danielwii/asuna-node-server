import sgMail from '@sendgrid/mail';

import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'node:url';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  public constructor() {
    if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  /**
   * send email via sendgrid
   * @param to
   * @param from
   * @param subject
   * @param content
   */
  public sendEmail(to: string, from: string, subject: string, content: string) {
    return sgMail.send({
      to,
      from,
      subject,
      text: content,
      html: content,
    });
  }
}
