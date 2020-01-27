import { NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import { resolve } from 'path';

import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DynamicRouterHelper } from './dynamic-router.helper';

const logger = LoggerFactory.getLogger('DynamicRouterMiddleware');

export class DynamicRouterMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: () => void): Promise<void> {
    /*
    logger.log(
      `use ${r(
        _.omit(req, 'res', 'app', 'socket', 'connection', 'client', 'readableState', '_readableState', '_events'),
      )}`,
    );
    logger.log(`use ${r(Object.keys(req))}`);
*/

    const config = await DynamicRouterHelper.getConfig();

    const found = _.find(config?.textRouter, field => resolve(`/${field.path}`) === req.baseUrl);
    if (found) {
      logger.log(`found ${r({ config, found })}`);
      res.send(found.text);
      return;
    }

    next();
  }
}
