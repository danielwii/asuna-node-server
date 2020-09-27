import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { CursoredPageable, Pageable } from '../core/helpers';
import { GraphqlContext } from '../dataloader';
import { CursoredRequestInput, GraphqlHelper, PageRequestInput } from '../graphql';
import { PaymentItem, PaymentMethod } from './payment.entities';
import { PaymentOrder } from './payment.order.entities';

@Resolver()
export class PaymentQueryResolver {
  private logger = LoggerFactory.getLogger(PaymentQueryResolver.name);

  @Query()
  public async api_payment_methods(@Context() ctx: GraphqlContext): Promise<PaymentMethod[]> {
    this.logger.log(`api_payment_methods ...`);
    return PaymentMethod.find({ isPublished: true });
  }

  @Query()
  public async api_payment_item(@Args('id') id: string, @Context() ctx: GraphqlContext): Promise<PaymentItem> {
    this.logger.log(`api_payment_item: ${id}`);
    const { paymentItems: loader } = ctx.getDataLoaders();
    return loader.load(id);
  }

  @Query()
  public async api_paged_payment_items(
    @Args('pageRequest') pageRequest: PageRequestInput,
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
  @Query()
  public async admin_paged_payment_orders(
    @Args('cursoredRequest') cursoredRequest: CursoredRequestInput,
  ): Promise<CursoredPageable<PaymentOrder>> {
    this.logger.log(`admin_paged_payment_orders ${r(cursoredRequest)}`);
    return GraphqlHelper.handleCursoredQueryRequest({ cls: PaymentOrder, cursoredRequest });
  }
}
