import { AppInfo } from '../app/app.entities';
import { Feedback, FeedbackReply } from '../content/feedback.entities';
import { UserProfile } from '../core/auth';
import { KeyValueModel, KeyValuePair } from '../core/kv/kv.entities';
import { PaymentItem, PaymentMethod } from '../payments';
import { WXMiniAppUserInfo } from '../wechat/wechat.entities';
import { DataLoaderFunction, loader } from './dataloader';
import { UserActivity } from '../core/interaction/activities.entities';

export type DefaultRegisteredLoaders = {
  wxMiniAppUserInfo: DataLoaderFunction<WXMiniAppUserInfo>;
  keyValuePairs: DataLoaderFunction<KeyValuePair>;
  keyValueModels: DataLoaderFunction<KeyValueModel>;
  profiles: DataLoaderFunction<UserProfile>;
  appInfos: DataLoaderFunction<AppInfo>;
  paymentMethods: DataLoaderFunction<PaymentMethod>;
  paymentItems: DataLoaderFunction<PaymentItem>;
  feedback: DataLoaderFunction<Feedback>;
  feedbackReplies: DataLoaderFunction<FeedbackReply>;
  userActivities: DataLoaderFunction<UserActivity>;
};

export const defaultDataLoaders = {
  wxMiniAppUserInfo: loader<WXMiniAppUserInfo>(WXMiniAppUserInfo),
  keyValuePairs: loader<KeyValuePair>(KeyValuePair),
  keyValueModels: loader<KeyValueModel>(KeyValueModel, { isPublished: true }),
  profiles: loader<UserProfile>(UserProfile),
  appInfos: loader<AppInfo>(AppInfo, { isPublished: true }),
  paymentMethods: loader<PaymentMethod>(PaymentMethod, { isPublished: true }),
  paymentItems: loader<PaymentItem>(PaymentItem, { isPublished: true }),
  feedback: loader<Feedback>(Feedback),
  feedbackReplies: loader<FeedbackReply>(FeedbackReply),
  userActivities: loader<UserActivity>(UserActivity),
};
