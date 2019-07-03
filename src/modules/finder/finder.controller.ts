import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { Cryptor } from 'node-buffs';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import * as _ from 'lodash';
import * as querystring from 'querystring';
import { FinderService } from './finder.service';
import { AsunaError, AsunaException } from '../common';

const logger = new Logger('FinderController');

export const keyByType = {
  zones: 'settings.finder.zones',
  assets: 'settings.finder.assets',
};

export class FinderAssetsSettings {
  @IsIn(['https', 'http'])
  @IsOptional()
  protocol: 'https' | 'http';

  @IsString()
  hostname: string;

  @IsNumber()
  @IsOptional()
  port: number;
}

/**
 * api/v1/finder?query=des-encoded-base64&useEncrypt=true
 * api/v1/finder?query=`querystring.stringify({name: "default"})`
 */
@Controller('api/v1/finder')
export class FinderController {
  constructor(private readonly finderService: FinderService) {}

  @Get()
  async redirect(
    @Query('encrypt') encrypt: boolean,
    @Query('query') query: string,
    @Query('type') type: 'zones' | 'assets',
    @Req() req,
    @Res() res,
  ) {
    logger.log(`find ${JSON.stringify({ encrypt, query, type })}`);
    if (
      !(_.isString(query) && query.length > 0) ||
      !(_.isString(type) && ['zones', 'assets'].includes(type))
    ) {
      throw new AsunaException(AsunaError.BadRequest, 'params error');
    }

    const queryParam = querystring.parse(encrypt ? Cryptor.desDecrypt(query) : query) as any;
    logger.log(`query ${JSON.stringify(queryParam)} with ${keyByType[type]}`);

    const { name, path } = queryParam;
    const url = await this.finderService.getUrl(keyByType[type], type, name, path);
    return res.redirect(url);
  }
}

/**
 * f/{base64-encoded-str} encoded-str.encrypted
 */
@Controller('f')
export class ShortFinderController {
  constructor(private readonly finderService: FinderService) {}

  @Get(':q')
  async redirect(@Param('q') q: string, @Req() req, @Res() res) {
    logger.log(`find short ${JSON.stringify({ q })}`);
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

    const queryParam = querystring.parse(
      encrypt == true ? Cryptor.desDecrypt(query) : query,
    ) as any;
    logger.log(`query ${JSON.stringify(queryParam)} with ${keyByType[type]}`);

    const { name, path } = queryParam;
    const url = await this.finderService.getUrl(keyByType[type], type, name, path);
    return res.redirect(url);
  }
}
