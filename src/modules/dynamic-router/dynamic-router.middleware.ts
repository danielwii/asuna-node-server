import { NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import _ from 'lodash';

import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('DynamicRouterMiddleware');

export class DynamicRouterMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void): any {
    // logger.log(
    //   `use ${r(
    //     _.omit(req, 'res', 'app', 'socket', 'connection', 'client', 'readableState', '_readableState', '_events'),
    //   )}`,
    // );
    // logger.log(`use ${r(Object.keys(req))}`);
    next();
  }
}
