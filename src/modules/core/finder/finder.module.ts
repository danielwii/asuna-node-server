import { Module, OnModuleInit } from '@nestjs/common';
import { r } from '../../common/helpers';
import { ConfigKeys, configLoader } from '../../config';
import { AsunaCollections, KvModule, KvService } from '../kv';
import { LoggerFactory } from '../../common/logger';
import { FinderController, ShortFinderController } from './finder.controller';
import { FinderService } from './finder.service';

const logger = LoggerFactory.getLogger('FinderModule');

@Module({
  imports: [KvModule],
  providers: [FinderService],
  controllers: [FinderController, ShortFinderController],
  exports: [FinderService],
})
export class FinderModule implements OnModuleInit {
  constructor(private readonly kvService: KvService) {}

  public onModuleInit() {
    logger.log('init...');

    const assetsEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT);
    const assetsInternalEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_INTERNAL_ENDPOINT);
    const value = {
      default: { endpoint: assetsEndpoint },
      'internal-default': { endpoint: assetsInternalEndpoint },
    };
    logger.log(`setup assets finder ${r(value)}`);
    this.kvService
      .set({
        collection: AsunaCollections.SYSTEM_SERVER,
        key: 'settings.finder.assets',
        type: 'json',
        value,
      })
      .catch(reason => logger.error(reason));
  }
}
