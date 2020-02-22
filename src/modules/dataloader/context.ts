import { UserProfile } from '../core/auth';
import { KeyValueModel } from '../core/kv/kv.entities';
import { DataLoaderFunction, loader } from './dataloader';

export type DefaultRegisteredLoaders = {
  keyValueModels: DataLoaderFunction<KeyValueModel>;
  profiles: DataLoaderFunction<UserProfile>;
};

export type DefaultGetDataLoaders = () => DefaultRegisteredLoaders;

export const defaultDataLoaders = {
  keyValueModels: loader<KeyValueModel>(KeyValueModel),
  profiles: loader<UserProfile>(UserProfile),
};
