import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { Cryptor } from 'node-buffs';
import querystring from 'query-string';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { FinderHelper } from './finder.helper';

import type { Request, Response } from 'express';

const logger = new Logger(resolveModule(__filename, 'FinderController'));

/**
 * 主要应用来定位资源，设计上，可以作为一个调度器，用来调度到其他的平台上
 * api/v1/finder?query=des-encoded-base64&useEncrypt=true
 * api/v1/finder?query=`querystring.stringify({name: "default"})`
 */
@ApiTags('core')
@Controller('api/v1/finder')
export class FinderController {
  @Get()
  async redirect(
    @Query('encrypt') encrypt: boolean,
    @Query('query') query: string,
    @Query('type') type: 'zones' | 'assets',
    @Req() req,
    @Res() res,
  ): Promise<void> {
    logger.log(`find ${r({ encrypt, query, type })}`);
    if (!(_.isString(query) && query.length > 0) || !(_.isString(type) && ['zones', 'assets'].includes(type))) {
      throw new AsunaException(AsunaErrorCode.BadRequest, 'params error');
    }

    const queryParam = querystring.parse(encrypt ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${r(queryParam)} with ${type}`);

    const { name, path } = queryParam;
    const url = await FinderHelper.resolveUrl({ type, name, path });
    return res.redirect(url);
  }
}

/**
 * f/{base64-encoded-str} encoded-str.encrypted
 */
@ApiTags('core')
@Controller('f')
export class ShortFinderController {
  @Get(':q')
  async redirect(@Param('q') q: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    logger.log(`find short ${r({ q })}`);
    if (!(_.isString(q) && q.length > 0)) {
      throw new AsunaException(AsunaErrorCode.BadRequest, 'params error');
    }

    let query;
    let type: 'zones' | 'assets';
    let encrypt;
    try {
      let encodedQuery;
      [encodedQuery, encrypt, type] = Buffer.from(q, 'base64').toString('ascii').split('.') as any;
      query = Buffer.from(encodedQuery, 'base64').toString('ascii');
    } catch (error) {
      throw new AsunaException(AsunaErrorCode.BadRequest, 'decode error');
    }

    if (!(_.isString(type) && ['zones', 'assets'].includes(type))) {
      throw new AsunaException(AsunaErrorCode.InvalidParameter, 'invalid param');
    }

    const queryParam = querystring.parse(encrypt === true ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${r(queryParam)} with ${type}`);

    const { name, path } = queryParam;
    const url = await FinderHelper.resolveUrl({ type, name, path });
    return res.redirect(url);
  }
}
