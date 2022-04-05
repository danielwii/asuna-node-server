import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { DeleteResult } from 'typeorm';

import { UserProfile } from './auth';
import { UserFollow } from './interaction/follow.entities';

import type { InteractionFollowType } from './interaction/enum-values';

const logger = LoggerFactory.getLogger('UserHelper');

export class UserHelper {
  static async follow(follower: UserProfile, type: InteractionFollowType, following: string): Promise<UserFollow> {
    const [items, count] = await UserFollow.findAndCountBy({ type, follower: follower as any, following });
    if (count === 0) {
      return UserFollow.create({ type, follower, following }).save();
    }
    if (count > 1) {
      UserFollow.delete(items.slice(1).map((item) => item.id)).catch((reason) => logger.error(reason));
    }
    return items[1];
  }

  static async unfollow(follower: UserProfile, type: InteractionFollowType, following: string): Promise<DeleteResult> {
    return UserFollow.delete({ type, follower: follower as any, following });
  }
}
