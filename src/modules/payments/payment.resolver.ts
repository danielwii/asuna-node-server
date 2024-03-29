import { Logger } from '@nestjs/common';
import { Args, Context, ObjectType, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { CursoredPageable, CursoredResponse, Pageable, PaginatedResponse } from '../core/helpers';
import { CursoredRequestInput, GraphqlHelper, PageRequestInput, QueryResolver } from '../graphql';
import { PaymentItem, PaymentMethod, PaymentTransaction } from './payment.entities';
import { PaymentOrder } from './payment.order.entities';

import type { GraphqlContext } from '../dataloader';
import { fileURLToPath } from 'node:url';

@ObjectType()
class PaginatedPaymentItemResponse extends PaginatedResponse(PaymentItem) {}

@ObjectType()
class CursoredVisitorResponse extends CursoredResponse(PaymentOrder) {}

@Resolver()
export class PaymentQueryResolver extends QueryResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), PaymentQueryResolver.name));

  public constructor() {
    super([PaymentOrder, PaymentMethod, PaymentTransaction]);
  }

  @Query((returns) => [PaymentMethod])
  public async api_payment_methods(@Context() ctx: GraphqlContext): Promise<PaymentMethod[]> {
    this.logger.log(`api_payment_methods ...`);
    return PaymentMethod.findBy({ isPublished: true });
  }

  @Query((returns) => PaymentOrder)
  public async api_payment_order(@Args('id') id: string, @Context() ctx: GraphqlContext): Promise<PaymentOrder> {
    this.logger.log(`api_payment_order: ${id}`);
    const { paymentOrders: loader } = ctx.getDataLoaders();
    return loader.load(id);
  }

  @Query((returns) => PaymentItem)
  public async api_payment_item(@Args('id') id: string, @Context() ctx: GraphqlContext): Promise<PaymentItem> {
    this.logger.log(`api_payment_item: ${id}`);
    const { paymentItems: loader } = ctx.getDataLoaders();
    return loader.load(id);
  }

  @Query((returns) => PaginatedPaymentItemResponse)
  public async api_paged_payment_items(
    @Args('pageRequest', { type: () => PageRequestInput, nullable: true }) pageRequest: PageRequestInput,
    @Context() ctx: GraphqlContext,
  ): Promise<Pageable<PaymentItem>> {
    this.logger.log(`api_paged_payment_items ${r(pageRequest)}`);
    return GraphqlHelper.handlePagedDefaultQueryRequest<PaymentItem>({
      cls: PaymentItem,
      query: {},
      pageRequest,
      ctx,
      loader: (loaders) => loaders.paymentItems,
    });
  }

  // @UseGuards(new GqlAdminAuthGuard())
  @Query((returns) => CursoredVisitorResponse)
  public async admin_paged_payment_orders(
    @Args('request', { type: () => CursoredRequestInput }) request: CursoredRequestInput,
  ): Promise<CursoredPageable<PaymentOrder>> {
    this.logger.log(`admin_paged_payment_orders ${r(request)}`);
    return GraphqlHelper.handleCursoredQueryRequest({ cls: PaymentOrder, request });
  }
}

@Resolver((of) => PaymentOrder)
export class UserPaymentOrderResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), 'UserPaymentOrderResolver'));

  @ResolveField((returns) => PaymentTransaction)
  public async transaction(@Root() order: PaymentOrder, @Context() ctx: GraphqlContext): Promise<PaymentTransaction> {
    this.logger.debug(`load transaction for ${order.id}`);
    const { paymentTransactions: loader } = ctx.getDataLoaders();
    return loader.load(order.transactionId);
  }
}
