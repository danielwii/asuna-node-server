import { CacheWrapper } from '../cache/wrapper';
import { configLoader } from './loader';

export class EnvConfigure {
  public static load = async <R>(key: string, resolver): Promise<R> =>
    CacheWrapper.do({
      prefix: 'config',
      key,
      expiresInSeconds: configLoader.loadNumericConfig('CONFIG_EXPIRES_IN_SECONDS', 60),
      resolver,
    });
}
