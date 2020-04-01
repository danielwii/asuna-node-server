import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { JsonArray } from '../common/decorators';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { FeedbackSenderEnumValue } from './enum-values';
import { Feedback, FeedbackReply } from './feedback.entities';
import { FeedbackReplyBody } from './feedback.interface';

class CreateFeedbackDto {
  @IsString()
  name: string;
  @IsString()
  type: string;
  @IsArray()
  @IsOptional()
  images?: JsonArray;
  @IsString()
  description: string;
}

const logger = LoggerFactory.getLogger('ContentController');

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
}
