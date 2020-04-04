import { plainToClass } from 'class-transformer';
import { LoggerFactory } from '../common/logger';

export const EmailTmplConfigKeys = {
  templates: 'templates',
};

export class EmailTmplConfigObject {
  static logger = LoggerFactory.getLogger('EmailTmplConfigObject');

  templates: Record<'key', string>[];

  constructor(o: Partial<EmailTmplConfigObject>) {
    Object.assign(this, plainToClass(EmailTmplConfigObject, o, { enableImplicitConversion: true }));
  }
}
