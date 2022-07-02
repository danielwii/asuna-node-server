import { Logger } from '@nestjs/common';

import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { Expose, plainToInstance, Transform } from 'class-transformer';

import { configLoader } from '../config/loader';

export enum MQConfigKeys {
  enable = 'enable',
  url = 'url',
  host = 'host',
  port = 'port',
  username = 'username',
  password = 'password',
}

export class MQConfigObject {
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
    Object.assign(this, plainToInstance(MQConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(mqPrefix = ''): MQConfigObject {
    const appendPrefix = `${this.prefix}${mqPrefix ? `${mqPrefix}_`.toUpperCase() : ''}`;
    Logger.verbose(`try load env: ${appendPrefix}${MQConfigKeys.enable}`);
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
