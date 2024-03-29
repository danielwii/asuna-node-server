import { Injectable, Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { resolve } from 'node:path';

import { DynamicRouterService } from './dynamic-router.service';

import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class DynamicRouterMiddleware implements NestMiddleware {
  constructor(private readonly dynamicRouterService: DynamicRouterService) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    /*
    logger.log(
      `use ${r(
        _.omit(req, 'res', 'app', 'socket', 'connection', 'client', 'readableState', '_readableState', '_events'),
      )}`,
    );
    logger.log(`use ${r(Object.keys(req))}`);
*/

    const config = await this.dynamicRouterService.getConfig();

    const found = _.find(config?.textRouter, (field) => resolve(`/${field.path}`) === req.baseUrl);
    if (found) {
      Logger.log(`found ${r({ config, found })}`);
      res.send(found.text);
      return;
    }

    next();
  }
}
