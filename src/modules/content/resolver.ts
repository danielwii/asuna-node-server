import { Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Info, Query, Resolver } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { GqlAuthGuard } from '../graphql/auth.guard';
import { named } from '../helper/annotations';
import { ContentMedia } from './media.entities';

import type { GraphQLResolveInfo } from 'graphql';
import type { GraphqlContext } from '../dataloader/dataloader.interceptor';

@Resolver()
export class ContentQueryResolver {
  private readonly logger = new Logger(resolveModule(__filename, ContentQueryResolver.name));

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => [ContentMedia])
  @named
  async api_content_medias(
    @Context() ctx: GraphqlContext,
    @Info() info: GraphQLResolveInfo,
    funcName?: string,
  ): Promise<ContentMedia[]> {
    const { id } = ctx.getPayload();
    this.logger.log(`${funcName}: ${r({ id })}`);

    return ContentMedia.find({ where: { profileId: id }, order: { createdAt: 'desc' } });
  }

  @UseGuards(new GqlAuthGuard())
  @Query((returns) => ContentMedia, { nullable: true })
  @named
  async api_content_media(
    @Args('useFor') useFor: string,
    @Context() ctx: GraphqlContext,
    @Info() info: GraphQLResolveInfo,
    funcName?: string,
  ): Promise<ContentMedia> {
    const { id } = ctx.getPayload();
    this.logger.log(`${funcName}: ${r({ id })}`);

    return ContentMedia.findOneBy({ profileId: id, useFor });
  }
}
