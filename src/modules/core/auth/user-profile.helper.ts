// @ts-ignore
import ow from 'ow';

import { PasswordHelper } from './abstract.auth.service';
import { UserProfile } from './user.entities';

export class UserProfileHelper {
  static async updatePassword(profileId: string, password: string): Promise<void> {
    ow(profileId, 'profileId', ow.string.nonEmpty);
    ow(password, 'password', ow.string.nonEmpty);

    const { hash, salt } = PasswordHelper.encrypt(password);
    await UserProfile.update(profileId, { password: hash, salt });
  }
}
