import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { Pageable } from '../core/helpers';
import { GraphqlContext } from '../dataloader';
import { GraphqlHelper, PageRequestInput } from '../graphql';
import { PaymentItem, PaymentMethod } from './payment.entities';

@Resolver()
export class PaymentQueryResolver {
  logger = LoggerFactory.getLogger(PaymentQueryResolver.name);

  @Query()
  async api_payment_methods(@Context() ctx: GraphqlContext): Promise<PaymentMethod[]> {
    this.logger.log(`api_payment_methods ...`);
    return PaymentMethod.find({ isPublished: true });
  }

  @Query()
  async api_paged_payment_items(
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
}
