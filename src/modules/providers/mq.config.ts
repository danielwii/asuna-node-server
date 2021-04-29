import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { Expose, plainToClass, Transform } from 'class-transformer';

import { withP, withP2 } from '../common/helpers';
import { configLoader, YamlConfigKeys } from '../config';

const logger = LoggerFactory.getLogger('MQConfig');

export enum MQConfigKeys {
  enable = 'enable',
  url = 'url',
  host = 'host',
  port = 'port',
  username = 'username',
  password = 'password',
}

export class MQConfigObject {
  private static logger = LoggerFactory.getLogger('MQConfigObject');
  private static key = YamlConfigKeys.mq;
  private static prefix = `${MQConfigObject.key}_`;

  public enable?: boolean;
  public url?: string;
  public host?: string;
  public port?: number;
  public username?: string;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public password?: string;

  public constructor(o: Partial<MQConfigObject>) {
    Object.assign(this, plainToClass(MQConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(mqPrefix = ''): MQConfigObject {
    const appendPrefix = `${this.prefix}${mqPrefix ? `${mqPrefix}_`.toUpperCase() : ''}`;
    logger.verbose(`try load env: ${appendPrefix}${MQConfigKeys.enable}`);
    return withP2(
      (p): any => configLoader.loadConfig2(MQConfigObject.key, p),
      MQConfigKeys,
      (loader, keys) =>
        new MQConfigObject({
          enable: withP(keys.enable, loader),
          url: withP(keys.url, loader),
          host: withP(keys.host, loader),
          port: withP(keys.port, loader),
          password: withP(keys.password, loader),
          username: withP(keys.username, loader),
        }),
    );
  }
}
