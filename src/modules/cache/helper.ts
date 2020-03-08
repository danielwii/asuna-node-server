import { PrimaryKey } from '../common';
import { LoggerFactory } from '../common/logger';
import { DBCacheCleaner } from '../core/db';
import { dataLoaderCleaner } from '../dataloader/dataloader';
import { PubSubChannels, PubSubHelper } from '../pub-sub/pub-sub.helper';

const logger = LoggerFactory.getLogger('CacheHelper');

export type CleanCacheType = { action: 'clear'; payload: { key: string; id: PrimaryKey } };

export class CacheHelper {
  static pubClear({ key, id }: { id?: PrimaryKey; key: string }) {
    PubSubHelper.publish(PubSubChannels.dataloader, {
      action: 'clear',
      payload: { key, id },
    }).catch(reason => logger.error(reason));

    this.clear({ key, id });
  }

  static clear({ key, id }: { id?: PrimaryKey; key: string }) {
    dataLoaderCleaner.clear(key, id);
    DBCacheCleaner.clear(key);
  }
}
