import { Logger } from '@nestjs/common';

import { DBCacheCleaner } from '../core/db';
import { DataloaderCleaner } from '../dataloader/dataloader';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { PubSubChannels, PubSubHelper } from '../pub-sub/pub-sub.helper';

import type { PrimaryKey } from '../common';

const logger = new Logger(resolveModule(__filename, 'CacheHelper'));

export interface CleanCacheType {
  action: 'clear';
  payload: { key: string; id: PrimaryKey };
}

export class CacheHelper {
  public static pubClear({ key, id }: { id?: PrimaryKey; key: string }) {
    PubSubHelper.publish(PubSubChannels.dataloader, { action: 'clear', payload: { key, id } }).catch((reason) =>
      logger.error(reason),
    );

    this.clear({ key, id });
  }

  public static clear({ key, id }: { id?: PrimaryKey; key: string }) {
    if (id) DataloaderCleaner.clear(key, id);
    DBCacheCleaner.clear(key);
  }
}
