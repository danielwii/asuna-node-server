import { ConfigKeys, configLoader } from '../helpers';
import { join, resolve } from 'path';

export interface IAsunaContextOpts {
  /**
   * default: app
   */
  defaultModulePrefix?: string;
  root: string;
}

export class AsunaContext {
  private opts: IAsunaContextOpts = {
    defaultModulePrefix: 'www',
    root: resolve(__dirname, '../..'),
  };

  public readonly dirname: string;
  public readonly dbType: 'mysql56' | 'mysql57' | 'postgres';
  public static readonly instance = new AsunaContext();

  private constructor() {
    this.dirname = join(__dirname, '../..');
    this.dbType = configLoader.loadConfig(ConfigKeys.DB_TYPE, 'mysql57');
  }

  init(opts: IAsunaContextOpts) {
    if (opts == null) {
      throw new Error('opts must not be empty.');
    }
    this.opts = {
      defaultModulePrefix: opts.defaultModulePrefix || 'www',
      root: opts.root,
    };
  }

  get defaultModulePrefix() {
    return this.opts.defaultModulePrefix;
  }

  static get isDebugMode() {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
