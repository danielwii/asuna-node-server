import { ConfigKeys, configLoader } from '../helpers';
import idx from 'idx';
import { join } from 'path';

export interface IAsunaContextOpts {
  /**
   * default: app
   */
  defaultModulePrefix?: string;
  root: string;
}

export class AsunaContext {
  private opts: IAsunaContextOpts;
  public readonly dirname: string;
  public static readonly instance = new AsunaContext();

  private constructor() {
    this.dirname = join(__dirname, '../..');
  }

  init(opts: IAsunaContextOpts) {
    this.opts = {
      defaultModulePrefix: idx(opts, _ => _.defaultModulePrefix) || 'www',
      root: idx(opts, _ => _.root),
    };
  }

  get defaultModulePrefix() {
    return this.opts.defaultModulePrefix;
  }

  static get isDebugMode() {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
