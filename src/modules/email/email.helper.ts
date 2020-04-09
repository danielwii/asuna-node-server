import { Promise } from 'bluebird';
import * as EmailTemplate from 'email-templates';
import * as _ from 'lodash';
import { createTransport, SentMessageInfo } from 'nodemailer';
import Mail, { Attachment } from 'nodemailer/lib/mailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as path from 'path';
import { Observable, of, Subject } from 'rxjs';
import { concatMap, delay } from 'rxjs/operators';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger/factory';
import { DynamicConfigKeys, DynamicConfigs } from '../config/dynamicConfigs';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv';
import { MinioConfigObject, QiniuConfigObject } from '../core/storage/storage.config';
import { StorageMode } from '../core/storage/storage.engines';
import { WeChatHelper } from '../wechat';
import { EmailTmplConfigKeys, EmailTmplConfigObject } from './email-tmpl.config';
import { EmailConfigKeys, EmailConfigObject } from './email.config';
import { isMailAttachment, MailInfo } from './email.interface';

const logger = LoggerFactory.getLogger('EmailHelper');
const env = process.env.ENV;

// type SendAction = { future: () => Promise<any> };

// limit rate to 30/min
const TIME_INTERVAL = 2000;

export class EmailHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_EMAIL, key: 'config' };
  static tmplKvDef: KvDef = { collection: AsunaCollections.SYSTEM_EMAIL, key: 'templates' };

  static async getConfig(): Promise<EmailConfigObject> {
    return new EmailConfigObject(await KvHelper.getConfigsByEnumKeys(this.kvDef, EmailConfigKeys));
  }

  static async getTmplConfig(): Promise<EmailTmplConfigObject> {
    return new EmailTmplConfigObject(await KvHelper.getConfigsByEnumKeys(this.tmplKvDef, EmailTmplConfigKeys));
  }

  static sender = new Subject<{ email: MailInfo; cb: (info: MailInfo) => void }>();

  private static sender$ = new Observable<{ email: MailInfo; cb: (info: MailInfo) => void }>((fn) =>
    EmailHelper.sender.subscribe(fn),
  ).pipe(
    concatMap((value) => of(value).pipe(delay(TIME_INTERVAL))),
    // flatMap((value) => from(value.future)),
  );
  // .pipe(observeOn(queueScheduler, 5000));

  private static transporter: Mail;
  private static emailTemplate: EmailTemplate;

  static async init(): Promise<void> {
    const config = await this.getConfig();

    if (config.enable) {
      logger.log(`init by ${r(config)}`);
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
      logger.warn(`EMAIL settings must be set up to send mail in real world ${r(config)}`);
      EmailHelper.transporter = createTransport({ jsonTransport: true });
    }

    EmailHelper.emailTemplate = new EmailTemplate({
      message: { from: config.from || config.username },
      preview: false,
      send: true, // will send emails in development/test env
      subjectPrefix: env === 'production' ? false : `[${env.toUpperCase()}] `,
      transport: this.transporter,
    });

    EmailHelper.sender$.subscribe(({ email, cb }) =>
      EmailHelper.send(email)
        .catch((error) => logger.error(error))
        .finally(() => cb(email)),
    );
    logger.log(`initialized done ...`);
  }

  static async send(mailInfo: MailInfo): Promise<SentMessageInfo> {
    logger.verbose(`send ${r(_.omit(mailInfo, 'content'))}`);
    const { to, cc, bcc, subject, content, attachments } = mailInfo;
    const { from } = await this.getConfig();
    const storageConfigs = DynamicConfigs.get(DynamicConfigKeys.imageStorage);
    let domain = '';
    if (!storageConfigs) logger.warn(`no storage set for image`);
    else if (storageConfigs.mode === StorageMode.QINIU) {
      domain = (storageConfigs.loader() as QiniuConfigObject).domain;
    } else if (storageConfigs.mode === StorageMode.MINIO) {
      // FIXME domain position for attachments may not correct
      domain = (storageConfigs.loader() as MinioConfigObject).endpoint;
    }
    const mailOptions: Mail.Options = {
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
      ...(content ? { html: content } : null),
    };
    logger.verbose(`call mail sender ${r(_.omit(mailInfo, 'content', 'attachments'))}`);
    return EmailHelper.transporter.sendMail(mailOptions);
  }

  static async sendByTemplateKey(
    key: string,
    { to, attachments, context }: { to: string[]; attachments?: Attachment[]; context?: Record<string, any> },
  ): Promise<MailInfo> {
    const { templates } = await EmailHelper.getTmplConfig();
    const loaded = WeChatHelper.parseTemplateData(templates, context);
    const { subject, template } = loaded?.[key] ?? {};
    if (!subject && !template) {
      logger.error(`no ${key} found in email templates...`);
      return Promise.reject(new Error(`no ${key} found in email templates...`));
    }
    logger.verbose(`send template mail ${r({ key, subject })}`);
    return new Promise((resolve) => {
      EmailHelper.sender.next({
        email: { to, subject, content: template, attachments },
        cb: (info) => resolve(info),
      });
    });
  }

  static async sendByTemplate(
    template: string,
    data,
    { to, cc, bcc, subject, content, attachments }: MailInfo,
  ): Promise<any> {
    const templatePath = path.join(__dirname, 'emails', 'hello');
    logger.log(`found template for path: ${templatePath}`);
    return EmailHelper.emailTemplate.send({
      // text: body.content,
      template: templatePath,
      locals: data,
      message: { to, cc, bcc, attachments },
    });
  }
}
