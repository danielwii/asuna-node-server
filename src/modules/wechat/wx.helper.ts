import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { CacheManager } from '../cache';
import { WxBaseApi } from './wx.api.common';

enum WxKeys {
  accessToken = 'wx-access-token',
}

export class WxHelper {
  static async getAccessToken(mini?: boolean): Promise<string> {
    const key = mini ? `${WxKeys.accessToken}#mini` : WxKeys.accessToken;
    const redis = RedisProvider.getRedisClient('wx');
    // redis 未启用时将 token 保存到内存中，2h 后过期
    if (!redis.isEnabled) {
      return CacheManager.default.cacheable(
        key,
        async () => {
          Logger.warn(
            `redis is not enabled, ${
              mini ? 'mini' : ''
            } access token will store in memory and lost when app restarted.`,
          );
          return (await WxBaseApi.getAccessToken({ mini })).access_token;
        },
        2 * 3600,
      );
    }

    // redis 存在未过期的 token 时直接返回
    const accessToken = await redis.client.get(key);
    // const accessToken = await Promise.promisify(redis.client.get).bind(redis.client)(key);
    if (accessToken) return accessToken;

    const { results: token } = await RedisLockProvider.instance.lockProcess(
      key,
      async () => {
        const result = await WxBaseApi.getAccessToken({ mini });
        if (result.access_token) {
          Logger.debug(`getAccessToken with key(${key}): ${r(result)}`);
          // 获取 token 的返回值包括过期时间，直接设置为在 redis 中的过期时间
          await redis.client.setEx(key, result.expires_in, result.access_token);
          // await Promise.promisify(redis.client.setex).bind(redis.client)(key, result.expires_in, result.access_token);
          return result.access_token;
        }
        throw new AsunaException(AsunaErrorCode.Unprocessable, 'get access token error', result);
      },
      { ttl: 60 },
    );
    Logger.debug(`access token is ${r(token)}`);
    if (!token) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'no access token got');
    }
    return token;
  }
}
