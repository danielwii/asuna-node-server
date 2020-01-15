import { AfterInsert, AfterRemove, Entity, JoinColumn, OneToOne } from 'typeorm';
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
  @JoinColumn({ name: 'mini_app_user_info__id' })
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
