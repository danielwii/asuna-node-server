import { Logger } from '@nestjs/common';
import { Args, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { CursoredPageable, CursoredResponse } from '../core/helpers/page.helper';
import { CursoredRequestInput, GraphqlHelper } from '../graphql';
import { named } from '../helper/annotations';
import { Activity } from './entities';

@ObjectType()
class CursoredActivityResponse extends CursoredResponse(Activity) {}

@Resolver()
export class ActivityQueryResolver {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @Query((returns) => CursoredActivityResponse)
  @named
  public async admin_cursored_activities(
    @Args('request', { type: () => CursoredRequestInput }) request: CursoredRequestInput,
    @Args('refId') refId: string,
    @Args('name') name: string,
    funcName?: string,
  ): Promise<CursoredPageable<Activity>> {
    this.logger.log(`#${funcName}: ${r({ name, refId, request })}`);
    return GraphqlHelper.handleCursoredQueryRequest({ cls: Activity, where: { name }, request });
  }
}
