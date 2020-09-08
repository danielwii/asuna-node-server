import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Response } from 'express';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { AnyAuthRequest } from '../../helper';
import { JwtAdminAuthGuard } from '../auth';
import { KeyValuePair, KeyValueType } from './kv.entities';
import { KvDef, KvDefIdentifierHelper, KvHelper } from './kv.helper';

const logger = LoggerFactory.getLogger('KvController');

class KvPair {
  @IsString()
  @IsOptional()
  public collection?: string;

  @IsString()
  public key: string;

  @IsString()
  @IsOptional()
  public name?: string;

  @IsOptional()
  public type?: KeyValueType;

  @IsString()
  public value: any;

  @IsString()
  @IsOptional()
  public extra?: any;

  public toKvDef(): KvDef {
    return { collection: this.collection, key: this.key };
  }
}

class GetKvPairRequest {
  @IsString()
  public collection: string;

  @IsString()
  public key: string;

  @IsString()
  @IsOptional()
  public transform?: string;

  public toKvDef(): KvDef {
    return { collection: this.collection, key: this.key };
  }
}

@ApiTags('core')
@Controller('api')
export class KvController {
  @UseGuards(JwtAdminAuthGuard)
  @Post('kv')
  public async set(@Body() kvPair: KvPair, @Req() req: AnyAuthRequest): Promise<KeyValuePair> {
    const { user, identifier } = req;
    logger.log(`set ${r({ kvPair, user, identifier })}`);
    return KvHelper.set(KeyValuePair.create(kvPair));
  }

  @UseGuards(JwtAdminAuthGuard)
  @Post('kv/destroy')
  public async destroy(@Body() kvDef: KvDef, @Req() req: AnyAuthRequest): Promise<void> {
    const { user, identifier } = req;
    logger.log(`destroy ${r({ kvDef, user, identifier })}`);
    await KvHelper.delete(kvDef);
    const initializer = KvHelper.initializers[KvDefIdentifierHelper.stringify(kvDef)];
    if (initializer) await initializer();
    return null;
  }

  @Get('kv')
  public async get(
    @Query() query: GetKvPairRequest,
    @Req() req: AnyAuthRequest,
    @Res() res: Response,
  ): Promise<KeyValuePair> {
    const { user, identifier } = req;
    logger.log(`get ${r({ query, user, identifier })}`);
    await KvHelper.auth({ req, res }, query);
    // await KvHelper.checkPermission(query.toKvDef(), identifier);
    const result = await KvHelper.get(query.toKvDef());
    res.send(result);
    return result;
  }

  @Get('kvs')
  public async collection(
    @Query('collection') collection: string,
    @Req() req: AnyAuthRequest,
    @Res() res: Response,
  ): Promise<KeyValuePair[]> {
    const { user, identifier } = req;
    logger.log(`get kvs by ${r({ collection, user, identifier })}`);
    await KvHelper.auth({ req, res }, { collection });
    const result = await KvHelper.find(collection);
    res.send(result);
    return result;
  }
}
