import { Injectable } from '@nestjs/common';
import { oneLine } from 'common-tags';
import * as Email from 'email-templates';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as util from 'util';
import { r } from '../common/helpers';
import { configLoader, DynamicConfigKeys, DynamicConfigs } from '../config';
import { MinioConfigObject, QiniuConfigObject, StorageMode } from '../core';
import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getLogger('EmailService');
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
        `set ${r({
          MAIL_HOST: configLoader.loadConfig('MAIL_HOST'),
          MAIL_PORT: configLoader.loadNumericConfig('MAIL_PORT'),
          MAIL_SSL: `${configLoader.loadConfig('MAIL_SSL')}`,
        })}`,
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
      logger.warn(oneLine`
        MAIL_HOST && MAIL_PORT && MAIL_USERNAME && MAIL_PASSWORD
        must be set up to send mail in real world
      `);
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
    const storageConfigs = DynamicConfigs.get(DynamicConfigKeys.imageStorage);
    let domain = '';
    if (storageConfigs.mode === StorageMode.QINIU) {
      domain = (storageConfigs.loader() as QiniuConfigObject).domain;
    } else if (storageConfigs.mode === StorageMode.MINIO) {
      // FIXME domain position for attachments may not correct
      domain = (storageConfigs.loader() as MinioConfigObject).endpoint;
    }
    return this.email.send({
      message: {
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
