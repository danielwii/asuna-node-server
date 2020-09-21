import { plainToClass } from 'class-transformer';
import * as _ from 'lodash';
import { withP, withP3 } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader, YamlConfigKeys } from '../config/loader';

export enum GraphQLConfigKeys {
  debug = 'debug',
  playground_enable = 'playground_enable',
}

const logger = LoggerFactory.getLogger('GraphQLConfigObject');

export class GraphQLConfigObject {
  static key = YamlConfigKeys.graphql;
  static prefix = `${GraphQLConfigObject.key}_`;

  debug: boolean;
  playground_enable: boolean;

  constructor(o: Partial<GraphQLConfigObject>) {
    Object.assign(this, plainToClass(GraphQLConfigObject, o, { enableImplicitConversion: true }));
  }

  static load = (): GraphQLConfigObject =>
    withP3(
      GraphQLConfigObject.prefix,
      configLoader.loadConfig(YamlConfigKeys.graphql),
      GraphQLConfigKeys,
      (prefix, config, keys) =>
        new GraphQLConfigObject({
          debug: withP(keys.debug, (p) => configLoader.loadBoolConfig(`${prefix}${p}`, _.get(config, p))),
          playground_enable: withP(keys.playground_enable, (p) =>
            configLoader.loadBoolConfig(`${prefix}${p}`, _.get(config, p)),
          ),
        }),
    );
}
