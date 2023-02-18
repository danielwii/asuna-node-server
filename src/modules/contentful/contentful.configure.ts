import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ConfigureLoader, YamlConfigKeys } from '../core/config';

export enum ContentfulConfigKeys {
  enable = 'enable',
  spaceId = 'space_id',
  accessToken = 'access_token',
}

class ContentfulConfigObject implements Record<keyof typeof ContentfulConfigKeys, any> {
  @IsBoolean() @IsOptional() enable: boolean;
  @IsString() @IsOptional() spaceId: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  accessToken: string;
}

export interface ContentfulConfigure extends ConfigureLoader<ContentfulConfigObject> {}
@ConfigureLoader(YamlConfigKeys.contentful, ContentfulConfigKeys, ContentfulConfigObject)
export class ContentfulConfigure {}
