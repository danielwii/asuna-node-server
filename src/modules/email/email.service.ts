import { Injectable, Logger } from '@nestjs/common';
import * as Email from 'email-templates';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as util from 'util';

import { ConfigKeys, configLoader } from '../helpers/config.helper';

const logger = new Logger('EmailService');
const env = process.env.ENV;

@Injectable()
export class EmailService {
  private readonly transport: any;
  private readonly email: any;

  constructor() {
    if (
      configLoader.loadConfig('MAIL_HOST') &&
      configLoader.loadNumericConfig('MAIL_PORT') &&
      configLoader.loadConfig('MAIL_USERNAME') &&
      configLoader.loadConfig('MAIL_PASSWORD')
    ) {
      logger.log(
        `set ${util.inspect(
          {
            MAIL_HOST: configLoader.loadConfig('MAIL_HOST'),
            MAIL_PORT: configLoader.loadNumericConfig('MAIL_PORT'),
            MAIL_SSL: `${configLoader.loadConfig('MAIL_SSL')}`,
          },
          { colors: true },
        )}`,
      );
      this.transport = nodemailer.createTransport({
        host: configLoader.loadConfig('MAIL_HOST'),
        port: configLoader.loadNumericConfig('MAIL_PORT'),
        secure: `${configLoader.loadConfig('MAIL_SSL')}`, // upgrade later with STARTTLS
        auth: {
          user: configLoader.loadConfig('MAIL_USERNAME'),
          pass: configLoader.loadConfig('MAIL_PASSWORD'),
        },
      });
    } else {
      logger.warn(
        `MAIL_HOST && MAIL_PORT && MAIL_USERNAME && MAIL_PASSWORD must be set up to send mail in real world`,
      );
      this.transport = {
        jsonTransport: true,
      };
    }

    this.email = new Email({
      message: {
        from: configLoader.loadConfig('MAIL_FROM') || configLoader.loadConfig('MAIL_USERNAME'),
      },
      preview: false,
      send: true, // will send emails in development/test env
      subjectPrefix: env === 'production' ? false : `[${env.toUpperCase()}] `,
      transport: this.transport,
    });
  }

  async send({ to, cc, bcc, subject, content, attachments }) {
    return this.email.send({
      message: {
        to,
        cc,
        bcc,
        subject,
        attachments: attachments
          ? attachments.map(attachment => ({
              filename: attachment.name,
              path: `${configLoader.loadConfig(ConfigKeys.IMAGE_QINIU_DOMAIN)}/${
                attachment.prefix
              }/${attachment.filename}`,
            }))
          : null,
        ...(content ? { html: content } : null),
      },
    });
  }

  async sendByTemplate(template, data, { to, cc, bcc, subject, content, attachments }) {
    const templatePath = path.join(__dirname, 'emails', 'hello');
    logger.log(`found template for path: ${templatePath}`);
    return this.email.send({
      // text: body.content,
      template: templatePath,
      locals: data,
      message: { to, cc, bcc, attachments },
    });
  }
}
