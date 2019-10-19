import { Controller, Get, Param, Query, Req, Res, UseInterceptors } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import * as _ from 'lodash';
import { Cryptor } from 'node-buffs';
import * as querystring from 'querystring';
import { AsunaError, AsunaException, ControllerLoggerInterceptor, LoggerFactory, r } from '../../common';
import { FinderHelper } from './finder.helper';

const logger = LoggerFactory.getLogger('FinderController');

/**
 * 主要应用来定位资源，设计上，可以作为一个调度器，用来调度到其他的平台上
 * api/v1/finder?query=des-encoded-base64&useEncrypt=true
 * api/v1/finder?query=`querystring.stringify({name: "default"})`
 */
@ApiUseTags('core')
@UseInterceptors(ControllerLoggerInterceptor)
@Controller('api/v1/finder')
export class FinderController {
  @Get()
  async redirect(
    @Query('encrypt') encrypt: boolean,
    @Query('query') query: string,
    @Query('type') type: 'zones' | 'assets',
    @Req() req,
    @Res() res,
  ) {
    logger.log(`find ${r({ encrypt, query, type })}`);
    if (!(_.isString(query) && query.length > 0) || !(_.isString(type) && ['zones', 'assets'].includes(type))) {
      throw new AsunaException(AsunaError.BadRequest, 'params error');
    }

    const queryParam = querystring.parse(encrypt ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${r(queryParam)} with ${type}`);

    const { name, path } = queryParam;
    const url = await FinderHelper.getUrl({ type, name, path });
    return res.redirect(url);
  }
}

/**
 * f/{base64-encoded-str} encoded-str.encrypted
 */
@ApiUseTags('core')
@Controller('f')
export class ShortFinderController {
  @Get(':q')
  async redirect(@Param('q') q: string, @Req() req, @Res() res) {
    logger.log(`find short ${r({ q })}`);
    if (!(_.isString(q) && q.length > 0)) {
      throw new AsunaException(AsunaError.BadRequest, 'params error');
    }

    let query;
    let type: 'zones' | 'assets';
    let encrypt;
    try {
      let encodedQuery;
      [encodedQuery, encrypt, type] = Buffer.from(q, 'base64')
        .toString('ascii')
        .split('.') as any;
      query = Buffer.from(encodedQuery, 'base64').toString('ascii');
    } catch (e) {
      throw new AsunaException(AsunaError.BadRequest, 'decode error');
    }

    if (!(_.isString(type) && ['zones', 'assets'].includes(type))) {
      throw new AsunaException(AsunaError.InvalidParameter, 'invalid param');
    }

    const queryParam = querystring.parse(encrypt === true ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${r(queryParam)} with ${type}`);

    const { name, path } = queryParam;
    const url = await FinderHelper.getUrl({ type, name, path });
    return res.redirect(url);
  }
}
