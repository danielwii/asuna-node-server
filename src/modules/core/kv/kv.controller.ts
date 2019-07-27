import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import * as util from 'util';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { KeyValuePair, ValueType } from './kv.entities';
import { KvService } from './kv.service';

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
@Controller('api')
export class KvController {
  constructor(private readonly kvService: KvService) {}

  @Post('kv')
  async set(@Body() kvPair: KvPair) {
    logger.log(`set ${r(kvPair)}`);
    return this.kvService.set(KeyValuePair.create(kvPair));
  }

  @Get('kv')
  get(@Query() query: GetKvPairRequest) {
    logger.log(`get ${r(query)}`);
    return this.kvService.get(query.collection, query.key);
  }

  @Get('kvs')
  collection(@Query('collection') collection: string) {
    logger.log(`get kvs by ${collection}`);
    return this.kvService.find(collection);
  }
}
