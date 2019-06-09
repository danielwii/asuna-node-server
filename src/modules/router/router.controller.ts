import { Controller, Get, HttpStatus, Logger, Query, Req, Res } from '@nestjs/common';
import { AsunaCollections, KvService } from '../sys';
import { Cryptor } from 'node-buffs';
import querystring from 'querystring';

const logger = new Logger('RouterController');

const key = 'settings.router.zones';

/**
 * api/router?r=des-encoded-base64
 */
@Controller('api/v1/router')
export class RouterController {
  constructor(private readonly kvService: KvService) {}

  @Get()
  async redirect(@Query('r') r: string, @Req() req, @Res() res) {
    const query = querystring.parse(Cryptor.desDecrypt(r));
    logger.log(`query ${JSON.stringify(query)}`);
    const zones = await this.kvService.get(AsunaCollections.SYSTEM_SERVER, key);
    logger.log(`zones ${JSON.stringify(zones)}`);
    return res.redirect(
      HttpStatus.TEMPORARY_REDIRECT,
      // `${}`,
      /*`https://${headers.host}/${req.url}`*/
    );
  }
}
