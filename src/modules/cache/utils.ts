import { LoggerFactory } from '../common/logger';
import { CacheManager } from './cache';
import { CacheWrapper } from './wrapper';

const logger = LoggerFactory.getLogger('CacheUtils');

export class CacheUtils {
  static clear(opts: { prefix?: string; key: string | object }): void {
    CacheWrapper.clear(opts).catch(reason => logger.error(reason));
    CacheManager.clear(opts.key).catch(reason => logger.error(reason));
  }
}
