import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { WebController } from './controller';
import { PageView, PageViewSchema } from './schema';
import { WebService } from './service';
import { fileURLToPath } from "url";

@Module({
  imports: [MongooseModule.forFeature([{ name: PageView.name, schema: PageViewSchema }])],
  providers: [WebService],
  controllers: [WebController],
  exports: [WebService],
})
export class WebModule implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), WebModule.name));

  async onModuleInit(): Promise<void> {
    this.logger.log('init...');
  }
}
