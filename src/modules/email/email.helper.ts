import { Promise } from 'bluebird';
import * as EmailTemplate from 'email-templates';
import * as _ from 'lodash';
import { createTransport, SentMessageInfo } from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
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
import { EmailConfigKeys, EmailConfigObject } from './email.config';
import { MailInfo } from './email.interface';

const logger = LoggerFactory.getLogger('EmailHelper');
const env = process.env.ENV;

// type SendAction = { future: () => Promise<any> };

// limit rate to 30/min
const TIME_INTERVAL = 2000;

export class EmailHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_EMAIL, key: 'config' };

  static async getConfig(): Promise<EmailConfigObject> {
    return new EmailConfigObject(await KvHelper.getConfigsByEnumKeys(this.kvDef, EmailConfigKeys));
  }

  static sender = new Subject();

  private static sender$ = new Observable<MailInfo>((fn) => EmailHelper.sender.subscribe(fn)).pipe(
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
        host: config.host,
        port: config.port,
        secure: config.ssl, // upgrade later with STARTTLS
        auth: { user: config.username, pass: config.password },
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

    EmailHelper.sender$.subscribe((value) => {
      logger.verbose(`send ${r(value)}`);
      EmailHelper.send(value);
    });
    logger.log(`initialized done ...`);
  }

  static async send(mailInfo: MailInfo): Promise<SentMessageInfo> {
    logger.verbose(`send ${r(mailInfo)}`);
    const { to, cc, bcc, subject, content, attachments } = mailInfo;
    const storageConfigs = DynamicConfigs.get(DynamicConfigKeys.imageStorage);
    let domain = '';
    if (storageConfigs.mode === StorageMode.QINIU) {
      domain = (storageConfigs.loader() as QiniuConfigObject).domain;
    } else if (storageConfigs.mode === StorageMode.MINIO) {
      // FIXME domain position for attachments may not correct
      domain = (storageConfigs.loader() as MinioConfigObject).endpoint;
    }
    return EmailHelper.transporter.sendMail({
      to,
      cc,
      bcc,
      subject,
      attachments: _.map(attachments, (attachment) => ({
        filename: attachment.name,
        path: `${domain}/${attachment.prefix}/${attachment.filename}`,
      })),
      ...(content ? { html: content } : null),
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
