import { documentToHtmlString } from '@contentful/rich-text-html-renderer';

import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import contentful, { ContentfulClientApi } from 'contentful';
import _ from 'lodash';
import { fileURLToPath } from 'node:url';

import { CacheWrapper } from '../cache';
import { HandlebarsHelper } from '../common/helpers/handlebars';
import { ContentfulConfigure } from './contentful.configure';

import type { Document } from '@contentful/rich-text-types';

@Injectable()
export class ContentfulService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  private readonly config = ContentfulConfigure.load();
  private readonly client: ContentfulClientApi;

  public constructor() {
    this.client = contentful.createClient({
      space: this.config.spaceId,
      accessToken: this.config.accessToken,
      host: 'preview.contentful.com',
    });
  }

  public getTemplates = async (key: string): Promise<string> => {
    return CacheWrapper.do({
      prefix: 'contentful.templates',
      key,
      expiresInSeconds: 60,
      resolver: async () => {
        const entries = await this.client.getEntries({ content_type: 'templates', 'fields.key': key });
        // this.logger.log(`entries is ${r(entries)}`);
        const template = _.head(entries.items);
        if (template) {
          const document = (template.fields as any).content as Document;
          this.logger.log(`document is ${r({ key: (template.fields as any).key, nodeType: document.nodeType })}`);
          return documentToHtmlString(document);
        }
        return null;
      },
    });
  };

  public compileTemplate(html: string, context: Record<string, any>): string {
    return HandlebarsHelper.injectContext(html, context);
  }
}
