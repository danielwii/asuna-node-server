import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, getConnection, getManager, getRepository, Repository } from 'typeorm';
import { AsunaError, AsunaException } from '../../common/exceptions';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Hermes } from '../bus';
import { DBHelper } from '../db';
import { AbstractAuthService } from './abstract.auth.service';
import { AdminUser } from './auth.entities';
import { AbstractAuthUser } from './base.entities';

const logger = LoggerFactory.getLogger('AuthService');

export const HermesAuthEventKeys = {
  userCreated: 'user.created',
};

@Injectable()
export class AuthService extends AbstractAuthService {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super(
      ((): Repository<AbstractAuthUser> => {
        // 获得用户继承的 AbstractAuthUser
        const entityMetadata = getConnection().entityMetadatas.find(metadata => {
          if (DBHelper.isValidEntity(metadata)) {
            // logger.log(
            //   `${r({
            //     targetName: metadata.targetName,
            //     adminName: AdminUser.name,
            //     metadataTargetName: Object.getPrototypeOf(metadata.target).name,
            //     abstractAuthName: AbstractAuthUser.name,
            //   })}`,
            // );
            return (
              metadata.targetName !== AdminUser.name &&
              Object.getPrototypeOf(metadata.target).name === AbstractAuthUser.name
            );
          }
        });
        if (!entityMetadata) {
          logger.warn('no auth user repo found.');
          return null;
        }
        return getRepository(entityMetadata.target) as any;
      })(),
    );
  }

  async createUser(username: string, email: string, password: string) {
    const { hash, salt } = this.encrypt(password);

    let user = await this.getUser({ email, username });
    if (user) {
      logger.log(`found user ${r(user)}`);
      throw new AsunaException(AsunaError.Unprocessable, `user ${r({ username, email })} already exists.`);
    }

    return getManager()
      .save(this.userRepository.create({ email, username, isActive: true, password: hash, salt }))
      .then(result => {
        Hermes.emit(AuthService.name, HermesAuthEventKeys.userCreated, result);
        return result;
      });
  }
}
