import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { EntityManager, Transaction, TransactionManager } from 'typeorm';
import { AfterDate, AsunaErrorCode, AsunaException } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { UserProfile } from '../core/auth';
import { Hermes } from '../core/bus';
import { KvHelper } from '../core/kv';
import { Wallet } from './financial.entities';
import { HermesPointChangeEventKeys, PointExchange, PointExchangeTypeSettings } from './points.entities';
import { PropertyHelper } from './property.helper';

const logger = LoggerFactory.getLogger('PointsHelper');

export type PointChangeEventPayload = {
  point: number;
  type: keyof typeof PointExchangeTypeSettings;
  event: string;
  profileId: string;
  remark?: string;
};

export type VipVideoExchangeBody = { uuid: string };

export class PointsHelper {
  static async exchangeVipVideo(uuid: string, profileId: string): Promise<PointExchange> {
    const exists = await PointExchange.findOne({ type: 'vipVideoExchange', profileId, refId: uuid } as PointExchange);
    logger.log(`pointExchange ${r(exists)}`);
    if (exists) return exists;

    const cost = await KvHelper.getValueByGroupFieldKV(PropertyHelper.kvDef, 'vipVideoExchange');
    const current = await UserProfile.findOne(profileId, { relations: ['wallet'] });
    if (!current.wallet) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `not enough points: 0`);
    }

    if (current.wallet && current.wallet.points < cost) {
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `not enough points: ${current.wallet.points}, cost: ${cost}`,
      );
    }

    const exchange = await PointExchange.save({
      type: 'vipVideoExchange',
      profileId: profileId,
      body: { uuid } as VipVideoExchangeBody,
      refId: uuid,
      change: -cost,
      before: current.wallet.points,
      after: current.wallet.points - cost,
    } as PointExchange);

    current.wallet.points = exchange.after;
    await current.wallet.save();
    return exchange;
  }

  static async checkExchange(
    type: keyof typeof PointExchangeTypeSettings,
    profileId: string,
    body: any,
  ): Promise<PointExchange> {
    return PointExchange.findOne({ type, profileId, body: JSON.stringify(body) } as PointExchange);
  }

  static async getPointsByType(
    type: keyof typeof PointExchangeTypeSettings,
    profileId: string,
    after?: Date,
  ): Promise<{ total: number; items: PointExchange[] }> {
    const items = await PointExchange.find({ profileId, type, ...(after ? { createdAt: AfterDate(after) } : null) });
    return { total: _.sum(_.map(items, fp.get('change'))), items };
  }

  @Transaction()
  static async savePoints(
    change: number,
    type: keyof typeof PointExchangeTypeSettings,
    profileId: string,
    remark: string,
    @TransactionManager() manager?: EntityManager,
  ): Promise<PointExchange> {
    logger.log(`savePoints ${r({ change, type, profileId, remark })}`);
    const profile = await UserProfile.findOneOrFail(profileId, { relations: ['wallet'] });
    if (!profile.wallet) {
      profile.wallet = await manager.save<Wallet>(
        new Wallet({ profile, balance: 0, available: 0, frozen: 0, withdrawals: 0, points: 0 }),
      );
    }
    const [before, after] = [profile.wallet.points, profile.wallet.points + change];
    const pointExchange = PointExchange.create({ change, type, remark, before, after, profile });
    const exchange = await manager.save(pointExchange);
    await manager.update(Wallet, profile.wallet.id, { points: pointExchange.after });

    logger.log(`profileId: ${profileId} points changed '${type}' ${change}, succeed.`);
    return exchange;
  }

  static async handlePoints(
    type: keyof typeof PointExchangeTypeSettings,
    profileId: string,
    event: string,
    change?: number,
    remark?: string,
  ): Promise<void> {
    const point = (await KvHelper.getValueByGroupFieldKV(PropertyHelper.kvDef, type)) || change;
    logger.log(`get point ${r({ point, change })}`);
    if (_.isNumber(point)) {
      Hermes.emit(PointsHelper.name, HermesPointChangeEventKeys.pointsChange, {
        point,
        type,
        event,
        profileId,
        remark,
      } as PointChangeEventPayload);
    }
  }
}
