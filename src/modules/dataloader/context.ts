import { AppInfo } from '../app/app.entities';
import { UserProfile } from '../core/auth';
import { KeyValueModel } from '../core/kv/kv.entities';
import { DataLoaderFunction, loader } from './dataloader';

export type DefaultRegisteredLoaders = {
  keyValueModels: DataLoaderFunction<KeyValueModel>;
  profiles: DataLoaderFunction<UserProfile>;
  appInfos: DataLoaderFunction<AppInfo>;
};

export type DefaultGetDataLoaders = () => DefaultRegisteredLoaders;

export const defaultDataLoaders = {
  keyValueModels: loader<KeyValueModel>(KeyValueModel, { isPublished: true }),
  profiles: loader<UserProfile>(UserProfile),
  appInfos: loader<AppInfo>(AppInfo, { isPublished: true }),
};
