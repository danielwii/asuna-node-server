import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Response } from 'express';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { AnyAuthRequest } from '../../helper/auth';
import { JwtAdminAuthGuard } from '../auth/admin-auth.guard';
import { KeyValuePair, ValueType } from './kv.entities';
import { KvDef, KvDefIdentifierHelper, KvHelper } from './kv.helper';

const logger = LoggerFactory.getLogger('KvController');

class KvPair {
  @IsString()
  @IsOptional()
  collection?: string;

  @IsString()
  key: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  type?: keyof typeof ValueType;

  @IsString()
  value: any;

  @IsString()
  @IsOptional()
  extra?: any;

  toKvDef(): KvDef {
    return { collection: this.collection, key: this.key };
  }
}

class GetKvPairRequest {
  @IsString()
  collection: string;

  @IsString()
  key: string;

  @IsString()
  @IsOptional()
  transform?: string;

  toKvDef(): KvDef {
    return { collection: this.collection, key: this.key };
  }
}

@ApiTags('core')
@Controller('api')
export class KvController {
  @UseGuards(JwtAdminAuthGuard)
  @Post('kv')
  async set(@Body() kvPair: KvPair, @Req() req: AnyAuthRequest): Promise<KeyValuePair> {
    const { user, identifier } = req;
    logger.log(`set ${r({ kvPair, user, identifier })}`);
    return KvHelper.set(KeyValuePair.create(kvPair));
  }

  @UseGuards(JwtAdminAuthGuard)
  @Post('kv/destroy')
  async destroy(@Body() kvDef: KvDef, @Req() req: AnyAuthRequest): Promise<void> {
    const { user, identifier } = req;
    logger.log(`destroy ${r({ kvDef, user, identifier })}`);
    await KvHelper.delete(kvDef);
    const initializer = KvHelper.initializers[KvDefIdentifierHelper.stringify(kvDef)];
    if (initializer) await initializer();
    return null;
  }

  @Get('kv')
  async get(@Query() query: GetKvPairRequest, @Req() req: AnyAuthRequest, @Res() res: Response): Promise<KeyValuePair> {
    const { user, identifier } = req;
    logger.log(`get ${r({ query, user, identifier })}`);
    await KvHelper.auth({ req, res }, query);
    // await KvHelper.checkPermission(query.toKvDef(), identifier);
    const result = await KvHelper.get(query.toKvDef());
    res.send(result);
    return result;
  }

  @Get('kvs')
  async collection(
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
