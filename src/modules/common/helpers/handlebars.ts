import dayjs from 'dayjs';
import * as Handlebars from 'handlebars';
import _ from 'lodash';

import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getLogger('HandlebarsHelper');

// --------------------------------------------------------------
// register Handlebars helpers
// --------------------------------------------------------------

export class HandlebarsHelper {
  static init() {
    logger.log('init... register Handlebars helpers');
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
