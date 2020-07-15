import { Promise } from 'bluebird';
import { CacheManager } from '../cache';
import { AsunaErrorCode, AsunaException, LoggerFactory } from '../common';
import { r } from '../common/helpers';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv/kv.helper';
import { RedisLockProvider, RedisProvider } from '../providers';
import { WeChatFieldKeys, WeChatServiceConfig, WxApi } from './wx.api';

const logger = LoggerFactory.getLogger('WxHelper');

enum WxKeys {
  accessToken = 'wx-access-token',
}

export class WxHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_WECHAT, key: 'config' };

  static async getServiceConfig(): Promise<WeChatServiceConfig> {
    return new WeChatServiceConfig(await KvHelper.getConfigsByEnumKeys(WxHelper.kvDef, WeChatFieldKeys));
  }

  static async getAccessToken(mini?: boolean): Promise<string> {
    const key = mini ? `${WxKeys.accessToken}#mini` : WxKeys.accessToken;
    const redis = RedisProvider.instance.getRedisClient('wx');
    // redis 未启用时将 token 保存到内存中，2h 后过期
    if (!redis.isEnabled) {
      return CacheManager.cacheable(
        key,
        async () => {
          logger.warn(
            `redis is not enabled, ${
              mini ? 'mini' : ''
            } access token will store in memory and lost when app restarted.`,
          );
          return (await WxApi.getAccessToken({ mini })).access_token;
        },
        2 * 3600,
      );
    }

    // redis 存在未过期的 token 时直接返回
    const accessToken = await Promise.promisify(redis.client.get).bind(redis.client)(key);
    if (accessToken) return accessToken;

    const token = await RedisLockProvider.instance
      .lockProcess(
        key,
        async () => {
          const result = await WxApi.getAccessToken({ mini });
          if (result.access_token) {
            logger.debug(`getAccessToken with key(${key}): ${r(result)}`);
            // 获取 token 的返回值包括过期时间，直接设置为在 redis 中的过期时间
            await Promise.promisify(redis.client.setex).bind(redis.client)(key, result.expires_in, result.access_token);
            return result.access_token;
          }
          throw new AsunaException(AsunaErrorCode.Unprocessable, 'get access token error', result);
        },
        { ttl: 60 },
      )
      .catch((reason) => logger.error(reason));
    logger.debug(`access token is ${r(token)}`);
    if (!token) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'no access token got');
    }
    return token;
  }
}
