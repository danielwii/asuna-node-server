import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { r } from '../../common/helpers';
import { ControllerLoggerInterceptor, LoggerFactory } from '../../common/logger';
import { JwtAdminAuthGuard } from '../auth';
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
}

class GetKvPairRequest {
  @IsString()
  @IsOptional()
  collection?: string;

  @IsString()
  key: string;

  @IsString()
  @IsOptional()
  transform?: string;
}

@ApiUseTags('core')
@UseInterceptors(ControllerLoggerInterceptor)
@Controller('api')
export class KvController {
  @UseGuards(new JwtAdminAuthGuard())
  @Post('kv')
  async set(@Body() kvPair: KvPair) {
    logger.log(`set ${r(kvPair)}`);
    return KvHelper.set(KeyValuePair.create(kvPair));
  }

  @UseGuards(new JwtAdminAuthGuard())
  @Post('kv/destroy')
  async destroy(@Body() kvDef: KvDef) {
    logger.log(`destroy ${r(kvDef)}`);
    await KvHelper.delete(kvDef);
    const initializer = KvHelper.initializers[KvDefIdentifierHelper.stringify(kvDef)];
    initializer && (await initializer());
    return null;
  }

  @Get('kv')
  async get(@Query() query: GetKvPairRequest) {
    logger.log(`get ${r(query)}`);
    return KvHelper.get(query.collection, query.key);
  }

  @Get('kvs')
  collection(@Query('collection') collection: string) {
    logger.log(`get kvs by ${collection}`);
    return KvHelper.find(collection);
  }
}
