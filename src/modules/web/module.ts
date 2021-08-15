import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { r } from '@danielwii/asuna-helper';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { MongoConfigObject, MongoProvider } from '../providers';
import { WebController } from './controller';
import { PageViewSchema, PageView } from './schema';
import { WebService } from './service';

const logger = LoggerFactory.getLogger('WebModule');
const config = MongoConfigObject.load();
logger.log(`mongo config is ${r(config)}`);

@Module({
  imports: [MongooseModule.forFeature([{ name: PageView.name, schema: PageViewSchema }])],
  providers: [WebService],
  controllers: [WebController],
  exports: [],
})
export class WebModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    logger.log('init...');
  }
}
