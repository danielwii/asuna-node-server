import { Controller, Get, HttpStatus, Logger, Query, Req, Res } from '@nestjs/common';
import { Cryptor } from 'node-buffs';
import { IsIn, IsOptional, IsString } from 'class-validator';
import * as _ from 'lodash';
import * as querystring from 'querystring';
import { FinderService } from './finder.service';

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
  constructor(private readonly finderService: FinderService) {}

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

    const { name, path } = queryParam;
    const url = await this.finderService.getUrl(keyByType[type], type, name, path);
    return res.redirect(HttpStatus.TEMPORARY_REDIRECT, url);
  }
}
