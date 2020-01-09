import { Entity } from 'typeorm';
import { EntityMetaInfo } from '../../common/decorators';
import { AbstractTimeBasedAuthUser } from './base.entities';

@EntityMetaInfo({ name: 'auth__user_profiles' })
@Entity('auth__t_user_profiles')
export class UserProfile extends AbstractTimeBasedAuthUser {}
