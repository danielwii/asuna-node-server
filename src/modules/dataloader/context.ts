import _ from 'lodash';

import { AppInfo } from '../app';
import { Feedback, FeedbackReply } from '../content/feedback.entities';
import { Notification } from '../content/notification';
import { UserProfile } from '../core/auth';
import { UserActivity } from '../core/interaction';
import { KeyValuePair } from '../core/kv/kv.entities';
import { KeyValueModel } from '../core/kv/kv.isolated.entities';
import { PaymentItem, PaymentMethod, PaymentOrder, PaymentTransaction } from '../payments';
import { WXMiniAppUserInfo } from '../wechat';
import { DataLoaderFunction, loader } from './dataloader';

export interface DefaultRegisteredLoaders {
  wxMiniAppUserInfo: DataLoaderFunction<WXMiniAppUserInfo>;
  keyValuePairs: DataLoaderFunction<KeyValuePair>;
  keyValueModels: DataLoaderFunction<KeyValueModel>;
  profiles: DataLoaderFunction<UserProfile>;
  appInfos: DataLoaderFunction<AppInfo>;
  paymentMethods: DataLoaderFunction<PaymentMethod>;
  paymentItems: DataLoaderFunction<PaymentItem>;
  paymentOrders: DataLoaderFunction<PaymentOrder>;
  paymentTransactions: DataLoaderFunction<PaymentTransaction>;
  feedback: DataLoaderFunction<Feedback>;
  feedbackReplies: DataLoaderFunction<FeedbackReply>;
  userActivities: DataLoaderFunction<UserActivity>;
  notifications: DataLoaderFunction<Notification>;
}

export const getDefaultDataLoaders = _.memoize(() => ({
  wxMiniAppUserInfo: loader<WXMiniAppUserInfo>(WXMiniAppUserInfo),
  keyValuePairs: loader<KeyValuePair>(KeyValuePair),
  keyValueModels: loader<KeyValueModel>(KeyValueModel, { isPublished: true }),
  profiles: loader<UserProfile>(UserProfile),
  appInfos: loader<AppInfo>(AppInfo, { isPublished: true }),
  paymentMethods: loader<PaymentMethod>(PaymentMethod, { isPublished: true }),
  paymentItems: loader<PaymentItem>(PaymentItem, { isPublished: true }),
  paymentOrders: loader<PaymentOrder>(PaymentOrder),
  paymentTransactions: loader<PaymentTransaction>(PaymentTransaction),
  feedback: loader<Feedback>(Feedback),
  feedbackReplies: loader<FeedbackReply>(FeedbackReply),
  userActivities: loader<UserActivity>(UserActivity),
  notifications: loader<Notification>(Notification),
}));
