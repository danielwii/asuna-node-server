import { Controller, Get, HttpStatus, Logger, Query, Req, Res } from '@nestjs/common';
import { Cryptor } from 'node-buffs';
import { plainToClass } from 'class-transformer';
import { IsIn, IsOptional, IsString, validate } from 'class-validator';
import * as _ from 'lodash';
import * as querystring from 'querystring';
import { AsunaCollections, KvService } from '../core';
import urljoin = require('url-join');

const logger = new Logger('FinderController');

const keyByType = {
  zones: 'settings.finder.zones',
  assets: 'settings.finder.assets',
};

export class FinderAssetsSettings {
  @IsIn(['https', 'http'])
  @IsOptional()
  protocol: 'https' | 'http';

  @IsString()
  hostname: string;
}

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
      return res.status(HttpStatus.BAD_REQUEST).end();
    }

    const queryParam = querystring.parse(useEncrypt ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${JSON.stringify(queryParam)} with ${keyByType[type]}`);
    const upstreams = await this.kvService.get(AsunaCollections.SYSTEM_SERVER, keyByType[type]);
    logger.log(`upstreams ${JSON.stringify(upstreams)}`);
    if (!(upstreams && upstreams.value && _.isObject(upstreams.value))) {
      logger.warn(`${queryParam.name || 'default'} not available in upstream ${keyByType[type]}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
    }

    if (type === 'assets') {
      const upstream = upstreams.value[queryParam.name || 'default'];
      const finderAssetsSettings = plainToClass(FinderAssetsSettings, upstream);
      if (!finderAssetsSettings) {
        logger.warn(`invalid upstream ${JSON.stringify(upstream)}`);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
      }
      const errors = await validate(finderAssetsSettings);
      if (errors.length) {
        logger.warn(`invalid settings ${JSON.stringify(errors)}`);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
      }
      return res.redirect(
        HttpStatus.TEMPORARY_REDIRECT,
        `${upstream.protocol || 'https'}://${urljoin(upstream.hostname, queryParam.path)}`,
      );
    } else {
      // TODO add other handlers later
      logger.warn('only type assets available');
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
    }
  }
}
