import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { resolve } from 'path';

import { DynamicRouterHelper } from './dynamic-router.helper';

import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';

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

    const found = _.find(config?.textRouter, (field) => resolve(`/${field.path}`) === req.baseUrl);
    if (found) {
      logger.log(`found ${r({ config, found })}`);
      res.send(found.text);
      return;
    }

    next();
  }
}
