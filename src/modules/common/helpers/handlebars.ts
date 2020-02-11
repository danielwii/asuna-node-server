import * as dayjs from 'dayjs';
import * as Handlebars from 'handlebars';
import * as _ from 'lodash';
import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getLogger('EnrollmentHelper');

// --------------------------------------------------------------
// register Handlebars helpers
// --------------------------------------------------------------

logger.log('init... register Handlebars helpers');
Handlebars.registerHelper('dateFormat', (str: dayjs.ConfigType, template: string) => {
  return _.isString(template) ? dayjs(str).format(template) : dayjs(str).format();
});

export class HandlebarsHelper {
  static injectContext(message: string, context: object): string {
    return _.isString(message) ? Handlebars.compile(message)(context) : message;
  }
}
