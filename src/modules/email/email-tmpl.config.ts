import { plainToClass } from 'class-transformer';
import { LoggerFactory } from '../common/logger';

export const EmailTmplConfigKeys = {
  templates: 'templates',
};

export class EmailTmplConfigObject {
  private static logger = LoggerFactory.getLogger('EmailTmplConfigObject');

  public templates: Record<'key', string>[];

  public constructor(o: Partial<EmailTmplConfigObject>) {
    Object.assign(this, plainToClass(EmailTmplConfigObject, o, { enableImplicitConversion: true }));
  }
}
