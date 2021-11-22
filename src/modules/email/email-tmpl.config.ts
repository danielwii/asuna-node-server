import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { plainToInstance } from 'class-transformer';

export const EmailTmplConfigKeys = {
  templates: 'templates',
};

export class EmailTmplConfigObject {
  private static logger = LoggerFactory.getLogger('EmailTmplConfigObject');

  public templates: Record<'key', string>[];

  public constructor(o: Partial<EmailTmplConfigObject>) {
    Object.assign(this, plainToInstance(EmailTmplConfigObject, o, { enableImplicitConversion: true }));
  }
}
