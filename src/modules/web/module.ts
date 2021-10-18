import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { WebController } from './controller';
import { PageView, PageViewSchema } from './schema';
import { WebService } from './service';

const logger = LoggerFactory.getLogger('WebModule');

@Module({
  imports: [MongooseModule.forFeature([{ name: PageView.name, schema: PageViewSchema }])],
  providers: [WebService],
  controllers: [WebController],
  exports: [WebService],
})
export class WebModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
