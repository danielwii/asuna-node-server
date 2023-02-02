import { Body, Controller, Get, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsOptional, IsString } from 'class-validator';
import { fileURLToPath } from 'node:url';

import { JwtAdminAuthGuard } from '../auth/admin-auth.guard';
import { KeyValuePair, KeyValueType } from './kv.entities';
import { KvDef, KvService } from './kv.service';

import type { Response } from 'express';
import type { AnyAuthRequest } from '../../helper';

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
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly kvService: KvService) {}

  @UseGuards(JwtAdminAuthGuard)
  @Post('kv')
  public async set(@Body() kvPair: KvPair, @Req() req: AnyAuthRequest): Promise<KeyValuePair> {
    const { user, identifier } = req;
    this.logger.log(`set ${r({ kvPair, user, identifier })}`);
    return this.kvService.set(KeyValuePair.create(kvPair));
  }

  @UseGuards(JwtAdminAuthGuard)
  @Post('kv/destroy')
  public async destroy(@Body() kvDef: KvDef, @Req() req: AnyAuthRequest): Promise<void> {
    const { user, identifier } = req;
    this.logger.log(`destroy ${r({ kvDef, user, identifier })}`);
    await this.kvService.delete(kvDef);
    await this.kvService.reInitInitializer(kvDef);
  }

  @Get('kv')
  public async get(
    @Query() query: GetKvPairRequest,
    @Req() req: AnyAuthRequest,
    @Res() res: Response,
  ): Promise<KeyValuePair> {
    const { user, identifier } = req;
    this.logger.log(`get ${r({ query, user, identifier })}`);
    await this.kvService.auth({ req, res }, query);
    // await this.kvService.checkPermission(query.toKvDef(), identifier);
    const result = await this.kvService.get(query.toKvDef());
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
    this.logger.log(`get kvs by ${r({ collection, user, identifier })}`);
    await this.kvService.auth({ req, res }, { collection });
    const result = await this.kvService.find(collection);
    res.send(result);
    return result;
  }
}
