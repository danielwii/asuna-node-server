import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'url';

import { ContentfulConfigure } from './contentful.configure';
import { ContentfulController } from './contentful.controller';
import { ContentfulService } from './contentful.service';

@Module({
  providers: [ContentfulService],
  controllers: [ContentfulController],
  exports: [ContentfulService],
})
export class ContentfulModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), 'ContentfulModule'));
  onModuleInit = () =>
    this.init(async () => {
      this.logger.log(`init... ${r({ config: ContentfulConfigure.load() })}`);
    });
}
