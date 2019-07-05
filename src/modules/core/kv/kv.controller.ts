import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import * as util from 'util';
import { KeyValuePair, ValueType } from './kv.entities';
import { KvService } from './kv.service';

const logger = new Logger('KvController');

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
    logger.log(`set ${util.inspect(kvPair, { colors: true })}`);
    return this.kvService.set(KeyValuePair.create(kvPair));
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
