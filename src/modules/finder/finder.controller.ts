import * as _ from 'lodash';
import { Controller, Get, HttpStatus, Logger, Query, Req, Res } from '@nestjs/common';
import { Cryptor } from 'node-buffs';
import * as querystring from 'querystring';
import { AsunaCollections, KvService } from '../core';

const logger = new Logger('FinderController');

const keyByType = {
  zones: 'settings.finder.zones',
  assets: 'settings.finder.assets',
};

/**
 * api/v1/finder?query=des-encoded-base64&useEncrypt=true
 * api/v1/finder?query=`querystring.stringify({name: "default"})`
 */
@Controller('api/v1/finder')
export class FinderController {
  constructor(private readonly kvService: KvService) {}

  @Get()
  async redirect(
    @Query('useEncrypt') useEncrypt: boolean,
    @Query('query') query: string,
    @Query('type') type: 'zones' | 'assets',
    @Req() req,
    @Res() res,
  ) {
    logger.log(`find ${JSON.stringify({ useEncrypt, query, type })}`);
    if (
      !(_.isString(query) && query.length > 0) ||
      !(_.isString(type) && ['zones', 'assets'].includes(type))
    ) {
      return res.status(HttpStatus.I_AM_A_TEAPOT).end();
    }

    const queryParam = querystring.parse(useEncrypt ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${JSON.stringify(queryParam)} with ${keyByType[type]}`);
    const upstreams = await this.kvService.get(AsunaCollections.SYSTEM_SERVER, keyByType[type]);
    logger.log(`upstreams ${JSON.stringify(upstreams)}`);
    if (!(upstreams && upstreams.value && _.isObject(upstreams.value))) {
      logger.warn(`${queryParam.name || 'default'} not available in upstream ${keyByType[type]}`);
      return res.status(HttpStatus.I_AM_A_TEAPOT).end();
    }
    let upstream = upstreams.value[queryParam.name || 'default'];
    return res.redirect(
      HttpStatus.TEMPORARY_REDIRECT,
      `${upstream.protocol || 'https'}://${upstream.hostname}/${queryParam.path}`,
    );
  }
}
