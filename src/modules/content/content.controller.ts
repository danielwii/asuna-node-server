import { Body, Controller, Delete, Logger, Param, Post, Put, Req, UseGuards } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { FeedbackSenderEnumValue } from './enum-values';
import { Feedback, FeedbackReply } from './feedback.entities';
import { FeedbackReplyBody } from './feedback.interface';
import { ContentMedia, MediaType } from './media.entities';

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

const logger = new Logger(resolveModule(__filename, 'ContentController'));

@Controller('api/v1/content')
export class ContentController {
  @UseGuards(JwtAuthGuard)
  @Post('feedback')
  async addFeedback(@Body() body: CreateFeedbackDto, @Req() req: JwtAuthRequest): Promise<Feedback> {
    const { user } = req;
    logger.log(`save feedback ${r(body)}`);
    const feedback = Feedback.create({ ...body, profile: user, status: 'submitted' });
    return Feedback.save(feedback);
  }

  @UseGuards(JwtAuthGuard)
  @Post('feedback/:feedbackId/reply')
  async addFeedbackReply(
    @Param('feedbackId') feedbackId: number,
    @Body() body: FeedbackReplyBody,
    @Req() req: JwtAuthRequest,
  ): Promise<FeedbackReply> {
    const { user } = req;
    logger.log(`save feedback reply ${r({ feedbackId, body })}`);
    const feedbackReply = FeedbackReply.create({
      feedback: { id: feedbackId },
      description: body.description,
      refId: user.id,
      images: body.images,
      senderType: FeedbackSenderEnumValue.types.user,
    });
    return FeedbackReply.save(feedbackReply);
  }

  @UseGuards(JwtAuthGuard)
  @Post('media')
  async addMedia(@Body() body: UpsertMediaBody, @Req() req: JwtAuthRequest) {
    const { payload } = req;
    logger.log(`add media ${r({ payload, body })}`);
    return ContentMedia.create({
      profileId: payload.id,
      type: MediaType[body.type],
      content: body.media ?? [],
      useFor: body.useFor ?? 'gallery',
    } as ContentMedia).save();
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/media')
  async editMedia(@Param('id') id: string, @Body() body: UpsertMediaBody, @Req() req: JwtAuthRequest) {
    // ow(id, 'id', ow.string.nonEmpty);

    const { payload } = req;
    logger.log(`edit media ${r({ payload, id, body })}`);
    const media = await ContentMedia.findOneByOrFail({ id, profileId: payload.id });
    if (!media) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, '找不到对应的资源');
    }
    media.type = MediaType[body.type];
    media.content = body.media;
    media.useFor = body.useFor ?? 'gallery';
    return media.save();
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/media')
  async deleteMedia(@Param('id') id: string, @Req() req: JwtAuthRequest) {
    // ow(id, 'id', ow.string.nonEmpty);

    const { payload } = req;
    logger.log(`delete media ${r({ payload, id })}`);
    const media = await ContentMedia.findOneByOrFail({ id, profileId: payload.id });
    // if (!media) {
    //   throw new AsunaException(AsunaErrorCode.Unprocessable, '找不到对应的资源');
    // }
    return ContentMedia.delete(media.id);
  }
}
