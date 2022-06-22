import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { plainToInstance } from 'class-transformer';

export const EmailTmplConfigKeys = {
  templates: 'templates',
};

export class EmailTmplConfigObject {
  private static logger = new Logger(resolveModule(__filename, 'EmailTmplConfigObject'));

  public templates: Record<'key', string>[];

  public constructor(o: Partial<EmailTmplConfigObject>) {
    Object.assign(this, plainToInstance(EmailTmplConfigObject, o, { enableImplicitConversion: true }));
  }
}
