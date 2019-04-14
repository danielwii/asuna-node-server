import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as jwt from 'jsonwebtoken';
import { Cryptor } from 'node-buffs';
import {
  Connection,
  FindOneOptions,
  getConnection,
  getManager,
  getRepository,
  Repository,
} from 'typeorm';

import { ConfigKeys, configLoader } from '../../helpers';
import { AdminUser } from './auth.entities';
import { IJwtPayload } from './auth.interfaces';
import { DBService } from '../../base/db.service';
import { AbstractAuthUser } from './base.entities';

const logger = new Logger('AuthService');

@Injectable()
export class AuthService {
  private readonly userRepository: Repository<AbstractAuthUser>;
  private readonly cryptor = new Cryptor();

  constructor(@InjectConnection() private readonly connection: Connection) {
    const entityMetadata = getConnection().entityMetadatas.find(metadata => {
      if (DBService.isValidEntity(metadata)) {
        return (
          metadata.targetName !== AdminUser.name &&
          Object.getPrototypeOf(metadata.target).name === AbstractAuthUser.name
        );
      }
    });
    if (entityMetadata) {
      this.userRepository = getRepository(entityMetadata.target);
    }
  }

  encrypt(password: string) {
    return this.cryptor.passwordEncrypt(password);
  }

  passwordVerify(password: string, user: AbstractAuthUser) {
    logger.log(`passwordVerify(${password}, ${JSON.stringify(user)})`);
    return this.cryptor.passwordCompare(password, user.password, user.salt);
  }

  async createUser(username: string, email: string, password: string) {
    const { hash, salt } = this.encrypt(password);

    let user = await this.getUser({ email, username });
    if (!user) {
      user = this.userRepository.create({ email, username, isActive: true });
    }
    logger.log(`found user ${JSON.stringify(user)}`);
    user.password = hash;
    user.salt = salt;
    return getManager().save(user);
  }

  /**
   * TODO using env instead
   * @returns {Promise<void>}
   */
  async createToken(user: AbstractAuthUser) {
    logger.log(`createToken >> ${user.email}`);
    const expiresIn = 60 * 60 * 24 * 30;
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload = { id: user.id, username: user.username, email: user.email };
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return {
      expiresIn,
      accessToken: token,
    };
  }

  /**
   * TODO using db repo instead
   * @param jwtPayload
   * @returns {Promise<boolean>}
   */
  async validateUser(jwtPayload: IJwtPayload): Promise<boolean> {
    const left = Math.floor(jwtPayload.exp - Date.now() / 1000);
    logger.log(`validateUser >> ${JSON.stringify(jwtPayload)} expired in: ${left}s`);

    const user = await this.getUser(
      { email: jwtPayload.email, username: jwtPayload.username },
      true,
    );

    return user != null && user.id === jwtPayload.id;
  }

  public getUser(
    identifier: { email?: string; username?: string },
    isActive?: boolean,
    options?: FindOneOptions<AbstractAuthUser>,
  ) {
    return this.userRepository.findOne({ ...identifier, isActive }, options);
  }

  public getUserWithPassword(
    identifier: { email?: string; username?: string },
    isActive?: boolean,
  ) {
    return this.userRepository.findOne(
      { ...identifier, isActive },
      { select: ['id', 'username', 'email', 'password', 'salt'] },
    );
  }

  public updatePassword(id: number, password: string, salt: string) {
    return this.userRepository.update(id, { password, salt });
  }
}
