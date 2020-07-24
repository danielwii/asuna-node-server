import { UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, Resolver } from '@nestjs/graphql';
import { emptyOr, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtPayload } from '../core/auth';
import { Pageable } from '../core/helpers';
import { GqlAuthGuard, GraphqlHelper, PageRequestInput, SorterInput, toOrder } from '../graphql';
import { ExchangeCurrencyType, ExchangeObject } from './exchange.entities';
import { FinancialTransaction } from './financial.entities';
import { PointExchange } from './points.entities';

@Resolver()
export class PropertyQueryResolver {
  logger = LoggerFactory.getLogger('UserQueryResolver');

  @UseGuards(new GqlAuthGuard())
  @Query()
  async user_paged_exchangeRecords(
    @Args('type') type: string,
    @Args('refId') refId: string,
    @Args('pageRequest') pageRequest: PageRequestInput,
    @Info() info,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<Pageable<PointExchange>> {
    const currentUser = getCurrentUser() as JwtPayload;
    this.logger.log(`user_paged_exchangeRecords: ${r({ type, refId, pageRequest })}`);
    const [items, total] = await PointExchange.findAndCount(
      await GraphqlHelper.genericFindOptions<PointExchange>({
        cls: PointExchange,
        pageRequest,
        relationPath: `${PropertyQueryResolver.prototype.user_paged_exchangeRecords.name}.items`,
        info,
        where: { user: { id: currentUser.uid }, ...(type ? { type } : null), ...(refId ? { refId } : null) },
      }),
    );

    this.logger.verbose(`user_paged_exchangeRecords ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest, items, total });
  }

  @UseGuards(new GqlAuthGuard())
  @Query()
  async user_paged_financialTransactions(
    @Args('type') type: string,
    @Args('refId') refId: string,
    @Args('pageRequest') pageRequest: PageRequestInput,
    @Info() info,
    @Context('getCurrentUser') getCurrentUser,
  ): Promise<Pageable<FinancialTransaction>> {
    const currentUser = getCurrentUser() as JwtPayload;
    this.logger.log(`user_paged_financialTransactions: ${r({ type, refId, pageRequest })}`);
    const [items, total] = await FinancialTransaction.findAndCount(
      await GraphqlHelper.genericFindOptions<FinancialTransaction>({
        cls: FinancialTransaction,
        pageRequest,
        relationPath: `${PropertyQueryResolver.prototype.user_paged_financialTransactions.name}.items`,
        info,
        where: { user: { id: currentUser.uid }, ...(type ? { type } : null), ...(refId ? { refId } : null) },
      }),
    );

    this.logger.verbose(`user_paged_financialTransactions ${r({ total, pageRequest })}`);
    return GraphqlHelper.pagedResult({ pageRequest, items, total });
  }

  @Query()
  async api_exchangeObjects(
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
        where: { ...emptyOr(!!usage, { usage }) },
        order: toOrder(orderBy),
      }),
    );

    this.logger.debug(`api_exchangeObjects ${r({ total })}`);
    return items;
  }
}
