import { Body, Controller, Get, Logger, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Transform } from 'class-transformer';
import { IsDate, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import _ from 'lodash';
import { fileURLToPath } from 'node:url';

import { AnyAuthGuard } from '../auth/auth.guard';
import { OperationToken, OperationTokenType, TokenRule } from './entities';
import { OperationTokenHelper } from './helper';

import type { AnyAuthRequest } from '../../helper/interfaces';

export class ObtainOperationTokenDto {
  @IsIn(_.keys(OperationTokenType))
  readonly type: keyof typeof OperationTokenType;

  @IsOptional()
  readonly payload?: object;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly service: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly key: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value || value === 0 ? Number(value) : null))
  readonly expiredInMinutes?: number;

  @ValidateIf((o, value: Date) => !value || Date.now() < value.getTime())
  @IsDate()
  @IsOptional()
  readonly expiredAt?: Date;

  @IsNumber()
  @Max(999)
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value || value === 0 ? Number(value) : null))
  readonly remainingCount?: number;

  constructor(o: ObtainOperationTokenDto) {
    Object.assign(this, deserializeSafely(ObtainOperationTokenDto, o));
  }
}

class RedeemQuery {
  @IsIn(_.keys(TokenRule))
  readonly role: keyof typeof TokenRule = 'operation';

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly key: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly service: string;
}

class GetParams {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly token: string;
}

@ApiTags('core')
@Controller('api/v1/operation-token')
export class OperationTokenController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @UseGuards(AnyAuthGuard)
  @Post()
  obtain(@Body() dto: ObtainOperationTokenDto, @Req() req: AnyAuthRequest): Promise<OperationToken> {
    const { identifier } = req;
    this.logger.log(`obtain token ${r(dto)}`);
    // TODO conflict validation for different types
    return OperationTokenHelper.obtainToken({ ...dto, role: 'operation', identifier } as any);
  }

  @UseGuards(AnyAuthGuard)
  @Post('resolver')
  obtainByResolver(@Query('key') key: string, @Req() req: AnyAuthRequest): Promise<OperationToken> {
    const { identifier, user } = req;
    this.logger.log(`obtain token by resolver: ${key}`);
    if (!OperationTokenHelper.resolver[key]) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `invalid key for token resolver: ${key}`);
    }
    return OperationTokenHelper.resolver[key]({ identifier, user });
  }

  @UseGuards(AnyAuthGuard)
  @Get(':token')
  async get(@Param() params: GetParams, @Req() req: AnyAuthRequest): Promise<OperationToken> {
    const { identifier } = req;
    this.logger.log(`get token ${r(params)}`);
    const token = await OperationTokenHelper.getTokenByToken(params.token);
    if (!token || token.identifier !== identifier) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'invalid operation token');
    }
    return token;
  }

  @UseGuards(AnyAuthGuard)
  @Get()
  redeem(@Query() query: RedeemQuery, @Req() req: AnyAuthRequest): Promise<OperationToken[]> {
    const { identifier } = req;
    this.logger.log(`redeem token ${r(query)}`);
    return OperationTokenHelper.redeemTokens({ ...query, identifier });
  }
}
