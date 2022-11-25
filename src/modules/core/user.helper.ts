import { Logger } from '@nestjs/common';

import { UserFollow } from './interaction/follow.entities';

import type { DeleteResult } from 'typeorm';
import type { UserProfile } from './auth';
import type { InteractionFollowType } from './interaction/enum-values';

export class UserHelper {
  static async follow(follower: UserProfile, type: InteractionFollowType, following: string): Promise<UserFollow> {
    const [items, count] = await UserFollow.findAndCountBy({ type, follower: follower as any, following });
    if (count === 0) {
      return UserFollow.create({ type, follower, following }).save();
    }
    if (count > 1) {
      UserFollow.delete(items.slice(1).map((item) => item.id)).catch((reason) => Logger.error(reason));
    }
    return items[1];
  }

  static async unfollow(follower: UserProfile, type: InteractionFollowType, following: string): Promise<DeleteResult> {
    return UserFollow.delete({ type, follower: follower as any, following });
  }
}
