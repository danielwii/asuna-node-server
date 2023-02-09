import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { ContentfulModule } from '../contentful';
import { KeyValueType } from '../core/kv/kv.entities';
import { KVModelFormatType } from '../core/kv/kv.isolated.entities';
import { KVGroupFieldsValue, KvService } from '../core/kv/kv.service';
import { EmailTmplConfigKeys } from './email-tmpl.config';
import { EmailConfigKeys, EmailConfigObject } from './email.config';
import { EmailController } from './email.controller';
import { EmailHelper } from './email.helper';
import { EmailService } from './email.service';

@Module({
  imports: [ContentfulModule],
  providers: [EmailService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly kvService: KvService) {
    super();
  }

  public onModuleInit = async (): Promise<void> =>
    this.init(async () => {
      this.logger.log(`init... ${r({ config: EmailConfigObject.load() })}`);

      await this.initKV();
      await EmailHelper.init();
      /* // test-only
      interval(300).subscribe((value) => {
        console.log('internal', value);
        EmailHelper.sender.next(value);
      }); */
    });

  public async initKV(): Promise<void> {
    this.kvService.regInitializer<KVGroupFieldsValue>(
      EmailHelper.kvDef,
      {
        name: '邮件配置',
        type: KeyValueType.json,
        value: {
          form: {
            default: {
              name: 'default',
              fields: [
                { name: '启用', field: { name: EmailConfigKeys.enable, type: 'boolean' } },
                { name: '地址', field: { name: EmailConfigKeys.host, type: 'string' } },
                { name: 'SMTP 端口', field: { name: EmailConfigKeys.port, type: 'number', defaultValue: 465 } },
                { name: '启用 ssl', field: { name: EmailConfigKeys.ssl, type: 'boolean', defaultValue: false } },
                { name: '发送邮箱', field: { name: EmailConfigKeys.from, type: 'string' } },
                { name: '用户名', field: { name: EmailConfigKeys.user, type: 'string' } },
                { name: '密码', field: { name: EmailConfigKeys.password, type: 'string' } },
                { name: 'interval', field: { name: EmailConfigKeys.interval, type: 'number', defaultValue: 2000 } },
              ],
            },
          },
          values: EmailConfigObject.load(),
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );
    this.kvService.regInitializer<KVGroupFieldsValue>(
      EmailHelper.tmplKvDef,
      {
        name: '邮件模版配置',
        type: KeyValueType.json,
        value: {
          form: {
            default: {
              name: 'default',
              fields: [{ name: 'templates', field: { name: EmailTmplConfigKeys.templates, type: 'emailTmplData' } }],
            },
          },
          values: {},
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );
  }
}
