import { Body, Controller, Delete, Logger, Param, Post, Put, Req, UseGuards } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { fileURLToPath } from 'node:url';

import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { FeedbackSenderEnumValue } from './enum-values';
import { Feedback, FeedbackReply } from './feedback.entities';
import { ContentMedia, MediaType } from './media.entities';

import type { FeedbackReplyBody } from './feedback.interface';
import type { JsonArray } from '../common/decorators';

class CreateFeedbackDto {
  @IsString() name: string;
  @IsString() type: string;
  @IsArray() @IsOptional() images?: JsonArray;
  @IsString() description: string;
}

class UpsertMediaBody {
  @IsEnum(MediaType) type: string;
  @IsArray() @IsOptional() media?: JsonArray;
  @IsString() @IsOptional() useFor?: string;
}

@Controller('api/v1/content')
export class ContentController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @UseGuards(new JwtAuthGuard())
  @Post('feedback')
  async addFeedback(@Body() body: CreateFeedbackDto, @Req() req: JwtAuthRequest): Promise<Feedback> {
    const { user } = req;
    this.logger.log(`save feedback ${r(body)}`);
    const feedback = Feedback.create({ ...body, profile: user, status: 'submitted' });
    return Feedback.save(feedback);
  }

  @UseGuards(new JwtAuthGuard())
  @Post('feedback/:feedbackId/reply')
  async addFeedbackReply(
    @Param('feedbackId') feedbackId: number,
    @Body() body: FeedbackReplyBody,
    @Req() req: JwtAuthRequest,
  ): Promise<FeedbackReply> {
    const { user } = req;
    this.logger.log(`save feedback reply ${r({ feedbackId, body })}`);
    const feedbackReply = FeedbackReply.create({
      feedback: { id: feedbackId },
      description: body.description,
      refId: user.id,
      images: body.images,
      senderType: FeedbackSenderEnumValue.types.user,
    });
    return FeedbackReply.save(feedbackReply);
  }

  @UseGuards(new JwtAuthGuard())
  @Post('media')
  async addMedia(@Body() body: UpsertMediaBody, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    this.logger.log(`add media ${r({ payload, body })}`);
    return ContentMedia.create({
      profileId: payload.id,
      type: MediaType[body.type],
      content: body.media ?? [],
      useFor: body.useFor ?? 'gallery',
    } as ContentMedia).save();
  }

  @UseGuards(new JwtAuthGuard())
  @Put(':id/media')
  async editMedia(@Param('id') id: string, @Body() body: UpsertMediaBody, @Req() req: JwtAuthRequest) {
    // ow(id, 'id', ow.string.nonEmpty);

    const { payload } = req;
    this.logger.log(`edit media ${r({ payload, id, body })}`);
    const media = await ContentMedia.findOneByOrFail({ id, profileId: payload.id });
    if (!media) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '找不到对应的资源');
    }
    media.type = MediaType[body.type];
    media.content = body.media;
    media.useFor = body.useFor ?? 'gallery';
    return media.save();
  }

  @UseGuards(new JwtAuthGuard())
  @Delete(':id/media')
  async deleteMedia(@Param('id') id: string, @Req() req: JwtAuthRequest) {
    // ow(id, 'id', ow.string.nonEmpty);

    const { payload } = req;
    this.logger.log(`delete media ${r({ payload, id })}`);
    const media = await ContentMedia.findOneByOrFail({ id, profileId: payload.id });
    // if (!media) {
    //   throw new AsunaException(AsunaErrorCode.Unprocessable, '找不到对应的资源');
    // }
    return ContentMedia.delete(media.id);
  }
}
