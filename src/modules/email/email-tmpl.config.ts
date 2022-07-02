import { plainToInstance } from 'class-transformer';

export const EmailTmplConfigKeys = {
  templates: 'templates',
};

export class EmailTmplConfigObject {
  public templates: Record<'key', string>[];

  public constructor(o: Partial<EmailTmplConfigObject>) {
    Object.assign(this, plainToInstance(EmailTmplConfigObject, o, { enableImplicitConversion: true }));
  }
}
