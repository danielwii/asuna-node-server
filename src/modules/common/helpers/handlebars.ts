import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import dayjs from 'dayjs';
import Handlebars from 'handlebars';
import _ from 'lodash';
import { fileURLToPath } from 'node:url';

// --------------------------------------------------------------
// register Handlebars helpers
// --------------------------------------------------------------

export class HandlebarsHelper {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  private static _: HandlebarsHelper = new HandlebarsHelper();

  static init() {
    HandlebarsHelper._.logger.log('init... register Handlebars helpers');
    Handlebars.registerHelper('dateFormat', (str: dayjs.ConfigType, template: string) => {
      // logger.debug(`dateFormat ${r({ str, value: dayjs(str).valueOf(), template })}`);
      if (template === 'milliseconds') {
        return dayjs(str).valueOf();
      }
      return _.isString(template) ? dayjs(str).format(template) : dayjs(str).format();
    });
  }

  static injectContext(message: string, context: object): string {
    return _.isString(message) ? Handlebars.compile(message)(context) : message;
  }
}
