import * as _ from 'lodash';
import { Subject } from 'rxjs';
import { parseJSONIfCould, promisify, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { RedisProvider } from '../providers';

const logger = LoggerFactory.getLogger('PubSubHelper');

export enum PubSubChannels {
  dataloader = 'dataloader',
}

export class PubSubHelper {
  static async publish(channel: string, payload: string | object) {
    const redis = RedisProvider.instance.getRedisClient('pub-sub-publisher');
    if (!redis.isEnabled) return Promise.resolve();

    logger.log(`publish ... ${r({ channel, payload })}`);
    const value = _.isObject(payload) ? JSON.stringify(payload) : payload;
    return promisify(redis.client.publish, redis.client)(channel, value);
  }

  static subscribe<T>(...channels: string[]): Subject<T> {
    const redis = RedisProvider.instance.getRedisClient('pub-sub-subscriber');
    const subscription = new Subject<T>();
    if (redis.isEnabled) {
      logger.log(`subscribe ... ${channels}`);
      const subscriber = redis.client;
      subscriber.subscribe(channels, (err, reply) => {
        logger.verbose(`sub ${r({ channels, reply })}`);
        // if (err) {
        //   reject(err);
        // } else {
        //   resolve(parseJSONIfCould(reply));
        // }
      });
      subscriber.on('message', (channel, message) => {
        subscription.next(parseJSONIfCould(message));
      });
      /*
      subscriber.on('subscribe', (channel, count) => {
        logger.log('Sub done');
        // publisher.publish('random', 'Subscribed done, waiting for unsubscribe !');
        // subscriber.unsubscribe('redis_channel@test_overall_health');
      });

      subscriber.on('unsubscribe', (channel, count) => {
        logger.log('Unsub done');
      }); */
    }

    return subscription;
  }
}
