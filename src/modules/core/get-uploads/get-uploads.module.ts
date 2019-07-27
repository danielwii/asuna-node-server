import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../../common/logger';
import { FinderModule } from '../finder';
import { GetUploadsController } from './get-uploads.controller';

const logger = LoggerFactory.getLogger('GetUploadsModule');

@Module({
  imports: [FinderModule],
  controllers: [GetUploadsController],
})
export class GetUploadsModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
