import { AppInfo } from '../app/app.entities';
import { UserProfile } from '../core/auth';
import { KeyValueModel } from '../core/kv/kv.entities';
import { PaymentItem, PaymentMethod } from '../payments';
import { DataLoaderFunction, loader } from './dataloader';

export type DefaultRegisteredLoaders = {
  keyValueModels: DataLoaderFunction<KeyValueModel>;
  profiles: DataLoaderFunction<UserProfile>;
  appInfos: DataLoaderFunction<AppInfo>;
  paymentMethods: DataLoaderFunction<PaymentMethod>;
  paymentItems: DataLoaderFunction<PaymentItem>;
};

export const defaultDataLoaders = {
  keyValueModels: loader<KeyValueModel>(KeyValueModel, { isPublished: true }),
  profiles: loader<UserProfile>(UserProfile),
  appInfos: loader<AppInfo>(AppInfo, { isPublished: true }),
  paymentMethods: loader<PaymentMethod>(PaymentMethod, { isPublished: true }),
  paymentItems: loader<PaymentItem>(PaymentItem, { isPublished: true }),
};
