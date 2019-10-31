import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, getManager, Repository } from 'typeorm';

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
  // 新用户
  userCreated: 'user.created',
};

@Injectable()
export class AuthService extends AbstractAuthService {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super(
      ((): Repository<AbstractAuthUser> => {
        // 获得用户继承的 AbstractAuthUser
        const entityMetadata = connection.entityMetadatas.find(metadata =>
          DBHelper.isValidEntity(metadata)
            ? metadata.targetName !== AdminUser.name &&
              Object.getPrototypeOf(metadata.target).name === AbstractAuthUser.name
            : false,
        );
        if (!entityMetadata) {
          logger.warn('no auth user repo found.');
          return null;
        }
        logger.log(`entityMetadata is ${entityMetadata.target}`);
        return connection.getRepository(entityMetadata.target) as any;
      })(),
    );
  }

  async createUser(username: string, email: string, password: string): Promise<AbstractAuthUser> {
    const { hash, salt } = this.encrypt(password);

    const user = await this.getUser({ email, username });
    if (user) {
      logger.log(`found user ${r(user)}`);
      throw new AsunaException(AsunaError.Unprocessable, `user ${r({ username, email })} already exists.`);
    }

    return getManager()
      .save(this.userRepository.create({ email, username, isActive: true, password: hash, salt }))
      .then(result => {
        Hermes.emit(AuthService.name, HermesAuthEventKeys.userCreated, result);
        return this.userRepository.findOne(result.id);
      });
  }
}
