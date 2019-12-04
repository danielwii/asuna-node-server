// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable import/no-duplicates */
import { Injectable } from '@nestjs/common';
import { oneLine } from 'common-tags';
import EmailTemplate from 'email-templates';
import * as mailer from 'nodemailer';
import { SentMessageInfo } from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as path from 'path';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, DynamicConfigKeys, DynamicConfigs } from '../config';
import { MinioConfigObject, QiniuConfigObject, StorageMode } from '../core';

const logger = LoggerFactory.getLogger('EmailService');
const env = process.env.ENV;

@Injectable()
export class EmailService {
  private readonly transporter: Mail;
  private readonly emailTemplate: EmailTemplate;

  constructor() {
    if (
      configLoader.loadConfig('MAIL_HOST') &&
      configLoader.loadNumericConfig('MAIL_PORT') &&
      configLoader.loadConfig('MAIL_USERNAME') &&
      configLoader.loadConfig('MAIL_PASSWORD')
    ) {
      logger.log(
        `set ${r({
          MAIL_HOST: configLoader.loadConfig('MAIL_HOST'),
          MAIL_PORT: configLoader.loadNumericConfig('MAIL_PORT'),
          MAIL_SSL: configLoader.loadBoolConfig('MAIL_SSL'),
        })}`,
      );
      const transport: SMTPTransport.Options = {
        host: configLoader.loadConfig('MAIL_HOST'),
        port: configLoader.loadNumericConfig('MAIL_PORT'),
        secure: configLoader.loadBoolConfig('MAIL_SSL'), // upgrade later with STARTTLS
        auth: {
          user: configLoader.loadConfig('MAIL_USERNAME'),
          pass: configLoader.loadConfig('MAIL_PASSWORD'),
        },
      };
      this.transporter = mailer.createTransport(transport);
    } else {
      logger.warn(oneLine`
        MAIL_HOST && MAIL_PORT && MAIL_USERNAME && MAIL_PASSWORD
        must be set up to send mail in real world
      `);
      this.transporter = mailer.createTransport({ jsonTransport: true });
    }

    this.emailTemplate = new EmailTemplate({
      message: {
        from: configLoader.loadConfig('MAIL_FROM') || configLoader.loadConfig('MAIL_USERNAME'),
      },
      preview: false,
      send: true, // will send emails in development/test env
      subjectPrefix: env === 'production' ? false : `[${env.toUpperCase()}] `,
      transport: this.transporter,
    });
  }

  async send({ to, cc, bcc, subject, content, attachments }): Promise<SentMessageInfo> {
    const storageConfigs = DynamicConfigs.get(DynamicConfigKeys.imageStorage);
    let domain = '';
    if (storageConfigs.mode === StorageMode.QINIU) {
      domain = (storageConfigs.loader() as QiniuConfigObject).domain;
    } else if (storageConfigs.mode === StorageMode.MINIO) {
      // FIXME domain position for attachments may not correct
      domain = (storageConfigs.loader() as MinioConfigObject).endpoint;
    }
    return this.transporter.sendMail({
      to,
      cc,
      bcc,
      subject,
      attachments: attachments
        ? attachments.map(attachment => ({
            filename: attachment.name,
            path: `${domain}/${attachment.prefix}/${attachment.filename}`,
          }))
        : null,
      ...(content ? { html: content } : null),
    });
  }

  async sendByTemplate(template, data, { to, cc, bcc, subject, content, attachments }): Promise<any> {
    const templatePath = path.join(__dirname, 'emails', 'hello');
    logger.log(`found template for path: ${templatePath}`);
    return this.emailTemplate.send({
      // text: body.content,
      template: templatePath,
      locals: data,
      message: { to, cc, bcc, attachments },
    });
  }
}
