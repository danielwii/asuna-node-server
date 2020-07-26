import ow from 'ow';
import { UpdateResult } from 'typeorm';
import { PasswordHelper } from './abstract.auth.service';
import { UserProfile } from './user.entities';

export class UserProfileHelper {
  static updatePassword(profileId: string, password: string): Promise<UpdateResult> {
    ow(profileId, 'profileId', ow.string.nonEmpty);
    ow(password, 'password', ow.string.nonEmpty);

    const { hash, salt } = PasswordHelper.encrypt(password);
    return UserProfile.update(profileId, { password: hash, salt });
  }
}
