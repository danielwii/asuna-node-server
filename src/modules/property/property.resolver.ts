import { UseGuards } from '@nestjs/common';
import { Args, Context, Field, Info, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Pageable, toPage } from '../core/helpers';
import { GqlAuthGuard, GraphqlHelper, PageRequestInput, SorterInput, toOrder } from '../graphql';
import { ExchangeCurrencyEnum } from './enum-values';
import { ExchangeObject } from './exchange.entities';
import { FinancialTransaction } from './financial.entities';
import { PointExchange } from './points.entities';

import type { ExchangeCurrencyType } from './enum-values';
import type { GraphQLResolveInfo } from 'graphql';

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
  public async user_paged_exchange_records(
    @Args('type', { nullable: true }) type: string,
    @Args('refId') refId: string,
    @Args('pageRequest', { nullable: true }) pageRequest: PageRequestInput,
    @Info() info: GraphQLResolveInfo,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<PointExchangePageable> {
    const currentUser = getCurrentUser();
    this.logger.log(`user_paged_exchange_records: ${r({ type, refId, pageRequest })}`);
    const [items, total] = await PointExchange.findAndCount(
      await GraphqlHelper.genericFindOptions<PointExchange>({
        cls: PointExchange,
        pageRequest: toPage(pageRequest),
        relationPath: `${PropertyQueryResolver.prototype.user_paged_exchange_records.name}.items`,
        info,
        where: { profileId: currentUser.id, ...(type ? { type } : null), ...(refId ? { refId } : null) },
      }),
    );

    this.logger.verbose(`user_paged_exchange_records ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest: toPage(pageRequest), items, total });
  }

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => FinancialTransactionPageable)
  public async user_paged_financial_transactions(
    @Args('type') type: string,
    @Args('refId') refId: string,
    @Args('pageRequest', { nullable: true }) pageRequest: PageRequestInput,
    @Info() info: GraphQLResolveInfo,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<FinancialTransactionPageable> {
    const currentUser = getCurrentUser();
    this.logger.log(`user_paged_financial_transactions: ${r({ type, refId, pageRequest })}`);
    const [items, total] = await FinancialTransaction.findAndCount(
      await GraphqlHelper.genericFindOptions<FinancialTransaction>({
        cls: FinancialTransaction,
        pageRequest: toPage(pageRequest),
        relationPath: `${PropertyQueryResolver.prototype.user_paged_financial_transactions.name}.items`,
        info,
        where: { profileId: currentUser.id, ...(type ? { type } : null), ...(refId ? { refId } : null) },
      }),
    );

    this.logger.verbose(`user_paged_financial_transactions ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest: toPage(pageRequest), items, total });
  }

  @Query((returns) => [ExchangeObject])
  public async api_exchange_objects(
    @Args('type', { type: () => ExchangeCurrencyEnum, nullable: true }) type: ExchangeCurrencyType,
    @Args('usage', { nullable: true }) usage: string,
    @Args('orderBy', { nullable: true }) orderBy: SorterInput,
    @Info() info: GraphQLResolveInfo,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<ExchangeObject[]> {
    this.logger.log(`api_exchange_objects: ${r({ type, usage, orderBy })}`);
    const [items, total] = await ExchangeObject.findAndCount(
      await GraphqlHelper.genericFindOptions<ExchangeObject>({
        cls: ExchangeObject,
        relationPath: `${PropertyQueryResolver.prototype.api_exchange_objects.name}.items`,
        info,
        where: { ...(usage ? { usage } : {}) } as any,
        order: toOrder(orderBy),
      }),
    );

    this.logger.debug(`api_exchange_objects ${r({ total })}`);
    return items;
  }
}
