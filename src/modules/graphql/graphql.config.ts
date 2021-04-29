import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { plainToClass } from 'class-transformer';
import _ from 'lodash';

import { withP2, withP3 } from '../common/helpers';
import { configLoader, YamlConfigKeys } from '../config/loader';

export enum GraphQLConfigKeys {
  debug = 'debug',
  playground_enable = 'playground_enable',
}

const logger = LoggerFactory.getLogger('GraphQLConfigObject');

export class GraphQLConfigObject {
  private static key = YamlConfigKeys.graphql;
  private static prefix = `${GraphQLConfigObject.key}_`;

  debug: boolean;
  playground_enable: boolean;

  public constructor(o: Partial<GraphQLConfigObject>) {
    Object.assign(this, plainToClass(GraphQLConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load = (): GraphQLConfigObject =>
    withP3(
      GraphQLConfigObject.prefix,
      configLoader.loadConfig(YamlConfigKeys.graphql),
      GraphQLConfigKeys,
      (prefix, config, keys) =>
        new GraphQLConfigObject({
          debug: withP2(_.toUpper(`${prefix}${keys.debug}`), keys.debug, (key, p) =>
            configLoader.loadBoolConfig(key, _.get(config, p)),
          ),
          playground_enable: withP2(_.toUpper(`${prefix}${keys.playground_enable}`), keys.playground_enable, (key, p) =>
            configLoader.loadBoolConfig(key, _.get(config, p)),
          ),
        }),
    );
  Z;
}
