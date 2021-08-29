import { UseGuards } from '@nestjs/common';
import { Args, Context, Field, Info, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Pageable } from '../core/helpers';
import { GqlAuthGuard, GraphqlHelper, PageRequestInput, SorterInput, toOrder } from '../graphql';
import { ExchangeObject } from './exchange.entities';
import { FinancialTransaction } from './financial.entities';
import { PointExchange } from './points.entities';

import type { JwtPayload } from '../core/auth';
import type { ExchangeCurrencyType } from './enum-values';

@ObjectType({ implements: () => [Pageable] })
class PointExchangePageable extends Pageable<PointExchange> {
  @Field((returns) => [PointExchange])
  items: PointExchange[];
}

@ObjectType({ implements: () => [Pageable] })
class FinancialTransactionPageable extends Pageable<FinancialTransaction> {
  @Field((returns) => [FinancialTransaction])
  items: FinancialTransaction[];
}

@Resolver()
export class PropertyQueryResolver {
  private logger = LoggerFactory.getLogger('UserQueryResolver');

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => PointExchangePageable)
  public async user_paged_exchangeRecords(
    @Args('type') type: string,
    @Args('refId') refId: string,
    @Args('pageRequest') pageRequest: PageRequestInput,
    @Info() info,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<PointExchangePageable> {
    const currentUser = getCurrentUser() as JwtPayload;
    this.logger.log(`user_paged_exchangeRecords: ${r({ type, refId, pageRequest })}`);
    const [items, total] = await PointExchange.findAndCount(
      await GraphqlHelper.genericFindOptions<PointExchange>({
        cls: PointExchange,
        pageRequest,
        relationPath: `${PropertyQueryResolver.prototype.user_paged_exchangeRecords.name}.items`,
        info,
        where: { profileId: currentUser.id, ...(type ? { type } : null), ...(refId ? { refId } : null) },
      }),
    );

    this.logger.verbose(`user_paged_exchangeRecords ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest, items, total });
  }

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => FinancialTransactionPageable)
  public async user_paged_financialTransactions(
    @Args('type') type: string,
    @Args('refId') refId: string,
    @Args('pageRequest') pageRequest: PageRequestInput,
    @Info() info,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<FinancialTransactionPageable> {
    const currentUser = getCurrentUser() as JwtPayload;
    this.logger.log(`user_paged_financialTransactions: ${r({ type, refId, pageRequest })}`);
    const [items, total] = await FinancialTransaction.findAndCount(
      await GraphqlHelper.genericFindOptions<FinancialTransaction>({
        cls: FinancialTransaction,
        pageRequest,
        relationPath: `${PropertyQueryResolver.prototype.user_paged_financialTransactions.name}.items`,
        info,
        where: { profileId: currentUser.id, ...(type ? { type } : null), ...(refId ? { refId } : null) },
      }),
    );

    this.logger.verbose(`user_paged_financialTransactions ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest, items, total });
  }

  @Query((returns) => [ExchangeObject])
  public async api_exchangeObjects(
    @Args('type') type: ExchangeCurrencyType,
    @Args('usage') usage: string,
    @Args('orderBy') orderBy: SorterInput,
    @Info() info,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<ExchangeObject[]> {
    this.logger.log(`api_exchangeObjects: ${r({ type, usage, orderBy })}`);
    const [items, total] = await ExchangeObject.findAndCount(
      await GraphqlHelper.genericFindOptions<ExchangeObject>({
        cls: ExchangeObject,
        relationPath: `${PropertyQueryResolver.prototype.api_exchangeObjects.name}.items`,
        info,
        where: { ...(usage ? { usage } : {}) },
        order: toOrder(orderBy),
      }),
    );

    this.logger.debug(`api_exchangeObjects ${r({ total })}`);
    return items;
  }
}
