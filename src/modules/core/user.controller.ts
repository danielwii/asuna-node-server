import { Body, Controller, Logger, Put, Req, UseGuards } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import _ from 'lodash';
import { fileURLToPath } from 'node:url';

import { AnyAuthGuard, JwtAuthRequestExtractor } from './auth/auth.guard';
import { UserProfile } from './auth/user.entities';

export class UpdatePortraitDto {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  portrait: string;
}

@Controller('api/v1/user')
export class UserController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @UseGuards(AnyAuthGuard)
  @Put('portrait')
  async updatePortrait(@Body() body: UpdatePortraitDto, @Req() req): Promise<void> {
    const authInfo = JwtAuthRequestExtractor.of(req);
    this.logger.log(`save portrait(${r(body)}) for user(${authInfo.profile.id})`);
    await UserProfile.update({ id: authInfo.profile.id }, { portrait: body.portrait });
  }
}
