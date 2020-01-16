import { AfterInsert, AfterRemove, Entity, OneToOne } from 'typeorm';
import { EntityMetaInfo } from '../../common/decorators';
import { WXMiniAppUserInfo } from '../../wechat/wechat.entities';
import { UserRegister } from '../user.register';
import { AbstractTimeBasedAuthUser } from './base.entities';

@EntityMetaInfo({ name: 'auth__user_profiles' })
@Entity('auth__t_user_profiles')
export class UserProfile extends AbstractTimeBasedAuthUser {
  constructor() {
    super('u');
  }

  @OneToOne(
    type => WXMiniAppUserInfo,
    info => info.profile,
  )
  miniAppUserInfo: WXMiniAppUserInfo;

  @AfterInsert()
  afterInsert(): void {
    UserRegister.createUserByProfile(this);
  }

  @AfterRemove()
  afterRemove(): void {
    UserRegister.removeUserByProfile(this);
  }
}
