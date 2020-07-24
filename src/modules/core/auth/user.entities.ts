import { AfterRemove, BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { EntityMetaInfo, MetaInfo } from '../../common/decorators';
import { UserRegister } from '../user.register';
import { AbstractTimeBasedAuthUser } from './base.entities';

import type { Constructor } from '../../base';
import type { FinancialTransaction, Wallet, PointExchange } from '../../property';
import type { WXMiniAppUserInfo } from '../../wechat';
import type { UserFollow } from '../interaction';

@EntityMetaInfo({ name: 'auth__user_profiles', internal: true })
@Entity('auth__t_user_profiles')
export class UserProfile extends AbstractTimeBasedAuthUser {
  constructor() {
    super('u');
  }

  @OneToOne('WXMiniAppUserInfo', 'profile')
  miniAppUserInfo: WXMiniAppUserInfo;

  @OneToMany('UserFollow', 'follower')
  follows: UserFollow[];

  @OneToMany('PointExchange', 'profile')
  exchangeRecords: PointExchange[];

  @OneToMany('FinancialTransaction', 'profile')
  financialTransactions: FinancialTransaction[];

  @OneToOne('Wallet', 'profile')
  wallet: Wallet;

  /* use AuthedUserHelper.createProfile
  @AfterInsert()
  afterInsert(): void {
    UserRegister.createUserByProfile(this).catch(console.error);
  }
*/

  @AfterRemove()
  afterRemove(): void {
    UserRegister.removeUserByProfile(this).catch(console.error);
  }
}

export const InjectUserProfile = <TBase extends Constructor<BaseEntity>>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 36, name: 'profile__id' })
    profileId?: string;

    @MetaInfo({ name: '账户' /* , accessible: 'readonly' */ })
    @OneToOne((type) => UserProfile)
    @JoinColumn({ name: 'profile__id' })
    profile?: UserProfile;
  }

  return ExtendableEntity;
};

export const InjectMultiUserProfile = <TBase extends Constructor<BaseEntity>>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 36, name: 'profile__id' })
    profileId?: string;

    @MetaInfo({ name: '账户' /* , accessible: 'readonly' */ })
    @ManyToOne((type) => UserProfile)
    @JoinColumn({ name: 'profile__id' })
    profile?: UserProfile;
  }

  return ExtendableEntity;
};
