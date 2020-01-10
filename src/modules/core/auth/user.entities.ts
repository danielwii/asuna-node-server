import { AfterInsert, AfterRemove, Entity } from 'typeorm';
import { EntityMetaInfo } from '../../common/decorators';
import { UserRegister } from '../user.register';
import { AbstractTimeBasedAuthUser } from './base.entities';

@EntityMetaInfo({ name: 'auth__user_profiles' })
@Entity('auth__t_user_profiles')
export class UserProfile extends AbstractTimeBasedAuthUser {
  constructor() {
    super('u');
  }

  @AfterInsert()
  afterInsert() {
    UserRegister.createUserByProfile(this);
  }

  @AfterRemove()
  afterRemove() {
    UserRegister.removeUserByProfile(this);
  }
}
