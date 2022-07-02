import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import * as fp from 'lodash/fp';
import { MoreThan } from 'typeorm';

import { UserProfile } from '../core/auth';
import { KvHelper } from '../core/kv';
import { Wallet } from './financial.entities';
import { HermesPointChangeEventKeys, PointExchange } from './points.entities';
import { PropertyHelper } from './property.helper';

export interface PointChangeEventPayload {
  point: number;
  type: string;
  event: string;
  profileId: string;
  remark?: string;
}

export interface VipVideoExchangeBody {
  uuid: string;
}

export class PointsHelper {
  public static async exchangeVipVideo(uuid: string, profileId: string): Promise<PointExchange> {
    const exists = await PointExchange.findOneBy(
      PointExchange.of({ type: 'vipVideoExchange', profileId, refId: uuid }) as any,
    );
    Logger.log(`pointExchange ${r(exists)}`);
    if (exists) return exists;

    const cost = await KvHelper.getValueByGroupFieldKV(PropertyHelper.kvDef, 'vipVideoExchange');
    const current = await UserProfile.findOne({ where: { id: profileId } as any, relations: ['wallet'] });
    if (!current.wallet) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `not enough points: 0`);
    }

    if (current.wallet && current.wallet.points < cost) {
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `not enough points: ${current.wallet.points}, cost: ${cost}`,
      );
    }

    const exchange = await PointExchange.save(
      new PointExchange<VipVideoExchangeBody>({
        type: 'vipVideoExchange',
        profileId: profileId,
        body: { uuid },
        refId: uuid,
        change: -cost,
        before: current.wallet.points,
        after: current.wallet.points - cost,
      }),
    );

    current.wallet.points = exchange.after;
    await current.wallet.save();
    return exchange;
  }

  public static async checkExchange(type: string, profileId: string, body: any): Promise<PointExchange> {
    return PointExchange.findOneBy(PointExchange.of({ type, profileId, body: JSON.stringify(body) }) as any);
  }

  public static async getPointsByType(
    type: string,
    profileId: string,
    after?: Date,
  ): Promise<{ total: number; items: PointExchange[] }> {
    const items = await PointExchange.findBy({ profileId, type, ...(after ? { createdAt: MoreThan(after) } : null) });
    return { total: _.sum(_.map(items, fp.get('change'))), items };
  }

  public static async savePoints(
    change: number,
    type: string,
    profileId: string,
    remark: string,
  ): Promise<PointExchange> {
    Logger.log(`savePoints ${r({ change, type, profileId, remark })}`);
    const profile = await UserProfile.findOneOrFail({ where: { id: profileId } as any, relations: ['wallet'] });
    if (!profile.wallet) {
      profile.wallet = await Wallet.save(
        new Wallet({ profile, balance: 0, available: 0, frozen: 0, withdrawals: 0, points: 0, totalRecharge: 0 }),
      );
    }
    const [before, after] = [profile.wallet.points, profile.wallet.points + change];
    const pointExchange = PointExchange.of({ change, type, remark, before, after, profile });
    const exchange = await PointExchange.save(pointExchange);
    await Wallet.update(profile.wallet.id, { points: pointExchange.after });

    Logger.log(`profileId: ${profileId} points changed '${type}' ${change}, succeed.`);
    return exchange;
  }

  public static async handlePoints(
    type: string,
    profileId: string,
    event: string,
    change?: number,
    remark?: string,
  ): Promise<void> {
    const point = (await KvHelper.getValueByGroupFieldKV(PropertyHelper.kvDef, type)) || change;
    Logger.log(`get point ${r({ point, change })}`);
    if (_.isNumber(point)) {
      Hermes.emit<PointChangeEventPayload>(PointsHelper.name, HermesPointChangeEventKeys.pointsChange, {
        point,
        type,
        event,
        profileId,
        remark,
      });
    }
  }
}
