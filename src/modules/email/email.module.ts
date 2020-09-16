import { Module, OnModuleInit } from '@nestjs/common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { KeyValueType, KvHelper, KVModelFormatType } from '../core/kv';
import { EmailTmplConfigKeys } from './email-tmpl.config';
import { EmailConfigKeys, EmailConfigObject } from './email.config';
import { EmailHelper } from './email.helper';

const logger = LoggerFactory.getLogger('EmailModule');

@Module({})
export class EmailModule implements OnModuleInit {
  public async onModuleInit(): Promise<void> {
    logger.log(`init... ${r({ config: EmailConfigObject.load() })}`);

    await this.initKV();
    await EmailHelper.init();
    /* test-only
    interval(300).subscribe((value) => {
      console.log('internal', value);
      EmailHelper.sender.next(value);
    });
*/
  }

  async initKV(): Promise<void> {
    KvHelper.regInitializer(
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
                { name: '用户名', field: { name: EmailConfigKeys.username, type: 'string' } },
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
    KvHelper.regInitializer(
      EmailHelper.tmplKvDef,
      {
        name: '邮件模版配置',
        type: KeyValueType.json,
        value: {
          form: {
            default: {
              name: 'default',
              fields: [{ name: 'templates', field: { name: EmailTmplConfigKeys.templates, type: 'email-tmpl-data' } }],
            },
          },
          values: {},
        },
      },
      { merge: true, formatType: KVModelFormatType.KVGroupFieldsValue },
    );
  }
}
