import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import EmailTemplate from 'email-templates';
import * as _ from 'lodash';
import { createTransport, SentMessageInfo, Transporter } from 'nodemailer';
import * as SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as path from 'path';
import { Observable, of, Subject } from 'rxjs';
import { concatMap, delay } from 'rxjs/operators';

import { DynamicConfigKeys, DynamicConfigs } from '../config';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv';
import { MinioConfigObject, QiniuConfigObject, StorageMode } from '../core/storage';
import { WeChatHelper } from '../wechat';
import { EmailTmplConfigKeys, EmailTmplConfigObject } from './email-tmpl.config';
import { EmailConfigKeys, EmailConfigObject } from './email.config';
import { isMailAttachment, MailInfo } from './email.interface';

import type { Attachment, Options } from 'nodemailer/lib/mailer';

// type SendAction = { future: () => Promise<any> };

// limit rate to 30/min
const TIME_INTERVAL = 2000;

export class EmailHelper {
  public static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_EMAIL, key: 'config' };
  public static tmplKvDef: KvDef = { collection: AsunaCollections.SYSTEM_EMAIL, key: 'templates' };

  public static async getConfig(): Promise<EmailConfigObject> {
    const kv = await KvHelper.get(this.kvDef);
    const configObject = new EmailConfigObject(await KvHelper.getConfigsByEnumKeys(this.kvDef, EmailConfigKeys));
    return !_.isEmpty(kv) ? configObject : EmailConfigObject.load();
  }

  public static async getTmplConfig(): Promise<EmailTmplConfigObject> {
    return new EmailTmplConfigObject(await KvHelper.getConfigsByEnumKeys(this.tmplKvDef, EmailTmplConfigKeys));
  }

  public static sender = new Subject<{ email: MailInfo; cb: (info: MailInfo) => void }>();

  private static sender$ = new Observable<{ email: MailInfo; cb: (info: MailInfo) => void }>((fn) =>
    EmailHelper.sender.subscribe(fn),
  ).pipe(
    concatMap((value) => of(value).pipe(delay(TIME_INTERVAL))),
    // flatMap((value) => from(value.future)),
  );
  // .pipe(observeOn(queueScheduler, 5000));

  private static transporter: Transporter;
  private static emailTemplate: EmailTemplate;

  public static async init(): Promise<void> {
    const config = await EmailHelper.getConfig();

    if (config.enable) {
      Logger.log(`init by ${r(config)}`);
      const transport: SMTPTransport.Options = {
        logger: true,
        host: config.host,
        port: config.port,
        secure: config.ssl, // upgrade later with STARTTLS
        auth: { user: config.username, pass: config.password },
        from: config.from,
      };
      EmailHelper.transporter = createTransport(transport);
    } else {
      Logger.warn(`EMAIL settings must be set up and enabled to send mail in real world ${r(config)}`);
      EmailHelper.transporter = createTransport({ jsonTransport: true });
    }

    EmailHelper.emailTemplate = new EmailTemplate({
      message: { from: config.from || config.username },
      preview: false,
      send: true, // will send emails in development/test env
      subjectPrefix: process.env.NODE_ENV === 'production' ? false : `[${_.upperCase(process.env.ENV)}] `,
      transport: this.transporter,
    });

    EmailHelper.sender$.subscribe(({ email, cb }) =>
      EmailHelper.send(email)
        .catch((error) => Logger.error(error))
        .finally(() => cb(email)),
    );
    Logger.log(`initialized done ...`);
  }

  public static async send(mailInfo: MailInfo): Promise<SentMessageInfo> {
    Logger.debug(`send ${r(_.omit(mailInfo, 'content'))}`);
    const { to, cc, bcc, subject, content, attachments } = mailInfo;
    const { from } = await EmailHelper.getConfig();
    const storageConfigs = DynamicConfigs.get(DynamicConfigKeys.imageStorage);
    let domain = '';
    if (!storageConfigs) Logger.warn(`no storage set for image`);
    else if (storageConfigs.mode === StorageMode.QINIU) {
      domain = (storageConfigs.loader() as QiniuConfigObject).domain;
    } else if (storageConfigs.mode === StorageMode.MINIO) {
      // FIXME domain position for attachments may not correct
      domain = (storageConfigs.loader() as MinioConfigObject).endpoint;
    }
    const mailOptions: Options = {
      from,
      to,
      cc,
      bcc,
      subject,
      attachments: _.map(attachments, (attachment) =>
        isMailAttachment(attachment)
          ? { filename: attachment.name, path: `${domain}/${attachment.prefix}/${attachment.filename}` }
          : (attachment as Attachment),
      ),
      ...(content ? { html: content } : {}),
    };
    Logger.debug(`call mail sender ${r(_.omit(mailInfo, 'content', 'attachments'))}`);
    return EmailHelper.transporter.sendMail(mailOptions);
  }

  public static async sendByTemplateKey(
    key: string,
    { to, attachments, context }: { to: string[]; attachments?: Attachment[]; context?: Record<string, string> },
  ): Promise<MailInfo> {
    const { templates } = await EmailHelper.getTmplConfig();
    const loaded = WeChatHelper.parseTemplateData(templates, context);
    const { subject, template } = loaded?.[key] ?? {};
    if (!subject && !template) {
      Logger.error(`no ${key} found in email templates...`);
      return Promise.reject(new Error(`no ${key} found in email templates...`));
    }
    Logger.debug(`send template mail ${r({ key, subject })}`);
    return new Promise((resolve) => {
      EmailHelper.sender.next({
        email: { to, subject, content: template, attachments },
        cb: (info) => resolve(info),
      });
    });
  }

  public static async sendByTemplate(
    template: string,
    data,
    { to, cc, bcc, subject, content, attachments }: MailInfo,
  ): Promise<any> {
    const templatePath = path.join(__dirname, 'emails', 'hello');
    Logger.log(`found template for path: ${templatePath}`);
    return EmailHelper.emailTemplate.send({
      // text: body.content,
      template: templatePath,
      locals: data,
      message: { to, cc, bcc, attachments },
    });
  }
}
