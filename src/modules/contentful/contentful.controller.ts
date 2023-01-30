import { Controller, Get, Logger, Query } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { fileURLToPath } from 'node:url';

import { configLoader } from '../config';
import { ContentfulService } from './contentful.service';

@Controller('api/v1/contentful')
export class ContentfulController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(private readonly contentfulService: ContentfulService) {}

  @Get('template')
  public async template(@Query('key') key: string): Promise<ApiResponse<any>> {
    this.logger.log(`get template ${r({ key })}}`);
    const template = await this.contentfulService.getTemplates(key ?? 'verification-code.email-signup');
    if (!template) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `no template found for key ${key}`);
    }
    /* // TODO for test
    const compiled = this.contentfulService.compileTemplate(template, {
      Username: 'Daniel',
      VerificationCode: '123456',
      MagicLink: '#',
      YourName: configLoader.loadConfig('APP_NAME', 'ASUNA-NODE-SERVER'),
      ExpirationTime: '10m',
    }); */
    return ApiResponse.success({ template });
  }
}
