import { LoggerFactory, PrimaryKey } from '../common';
import { DBCacheCleaner } from '../core/db';
import { dataLoaderCleaner } from '../dataloader/dataloader';
import { PubSubChannels, PubSubHelper } from '../pub-sub/pub-sub.helper';

const logger = LoggerFactory.getLogger('CacheHelper');

export interface CleanCacheType {
  action: 'clear';
  payload: { key: string; id: PrimaryKey };
}

export class CacheHelper {
  public static pubClear({ key, id }: { id?: PrimaryKey; key: string }) {
    PubSubHelper.publish(PubSubChannels.dataloader, {
      action: 'clear',
      payload: { key, id },
    }).catch((reason) => logger.error(reason));

    this.clear({ key, id });
  }

  public static clear({ key, id }: { id?: PrimaryKey; key: string }) {
    if (id) dataLoaderCleaner.clear(key, id);
    DBCacheCleaner.clear(key);
  }
}
