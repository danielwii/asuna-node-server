import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import * as util from 'util';
import { ValueType } from './kv.entities';
import { KvService } from './kv.service';

const logger = new Logger('KvController');

class KvPair {
  collection?: string;
  key: string;
  name?: string;
  type?: keyof typeof ValueType;
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

@Controller('api')
export class KvController {
  constructor(private readonly kvService: KvService) {}

  @Post('kv')
  async set(@Body() kvPair: KvPair) {
    logger.log(`set ${util.inspect(kvPair, { colors: true })}`);
    return this.kvService.set(
      kvPair.collection,
      kvPair.key,
      kvPair.name,
      kvPair.type,
      kvPair.value,
    );
  }

  @Get('kv')
  get(@Query() query: GetKvPairRequest) {
    logger.log(`get ${util.inspect(query, { colors: true })}`);
    return this.kvService.get(query.collection, query.key);
  }

  @Get('kvs')
  collection(@Query('collection') collection: string) {
    logger.log(`get kvs by ${collection}`);
    return this.kvService.find(collection);
  }
}
