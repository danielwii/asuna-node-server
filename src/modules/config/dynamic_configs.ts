export enum DynamicConfigKeys {
  imageStorage,
}

export class DynamicConfigs {
  private static configs = {};

  static setup(key: DynamicConfigKeys, opts: { loader?: () => any; [key: string]: any }) {
    this.configs[key] = opts;
  }

  static get(key: DynamicConfigKeys) {
    return this.configs[key];
  }
}
