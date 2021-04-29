import { AbstractConfigLoader } from '@danielwii/asuna-helper/dist/config';
import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { configLoader } from '../../config';

export enum UploaderConfigKeys {
  enable = 'enable',
  maxCount = 'max_count',
  resourcePath = 'resource_path',
  // uploadPath = 'upload_path',
}

export class UploaderConfigObject extends AbstractConfigLoader<UploaderConfigObject> {
  private static key = YamlConfigKeys.uploader;
  private static _: UploaderConfigObject;

  public static get instance() {
    if (UploaderConfigObject._) {
      return UploaderConfigObject._;
    }
    UploaderConfigObject._ = this.load();
    return UploaderConfigObject._;
  }

  public enable: boolean;
  public maxCount: number;
  public resourcePath: string;

  public static uploadPath: string;

  public static load = (reload = false): UploaderConfigObject => {
    if (UploaderConfigObject._ && !reload) {
      return UploaderConfigObject._;
    }
    UploaderConfigObject._ = withP2(
      (p): any => configLoader.loadConfig2(UploaderConfigObject.key, p),
      UploaderConfigKeys,
      (loader, keys): UploaderConfigObject =>
        new UploaderConfigObject({
          enable: withP(keys.enable, loader),
          maxCount: withP(keys.maxCount, loader) ?? 3,
          resourcePath: withP(keys.resourcePath, loader) ?? '/uploads',
          // uploadPath: withP(keys.uploadPath, loader),
        }),
    );
    return UploaderConfigObject._;
  };
}
