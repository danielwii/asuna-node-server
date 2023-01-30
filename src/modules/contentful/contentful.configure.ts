import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'class-validator';

import { configLoader } from '../config/loader';

export enum ContentfulConfigKeys {
  enable = 'enable',
  spaceId = 'space_id',
  accessToken = 'access_token',
}

class ContentfulConfigObject implements Record<keyof typeof ContentfulConfigKeys, any> {
  @IsBoolean()
  enable: boolean;
  @IsString()
  spaceId: string;
  @IsString()
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  accessToken: string;
}

export class ContentfulConfigure {
  private static key = 'contentful';
  private static _: ContentfulConfigObject;

  static load = (reload = false): ContentfulConfigObject => {
    if (ContentfulConfigure._ && !reload) return ContentfulConfigure._;
    ContentfulConfigure._ = withP2(
      (p) => configLoader.loadConfig2<any>(ContentfulConfigure.key, p),
      ContentfulConfigKeys,
      (loader, keys) =>
        deserializeSafely(ContentfulConfigObject, {
          enable: withP(keys.enable, loader),
          spaceId: withP(keys.spaceId, loader),
          accessToken: withP(keys.accessToken, loader),
        }),
    );
    return ContentfulConfigure._;
  };
}
