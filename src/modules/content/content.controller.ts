import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { JsonArray } from '../common/decorators';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { FeedbackSenderEnumValue } from './enum-values';
import { Feedback, FeedbackReply } from './feedback.entities';

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

class FeedbackReplyBody {
  @IsInt()
  feedbackId: number;
  @IsArray()
  images: JsonArray;
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
  @Post('feedback/reply')
  async addFeedbackReply(@Body() body: FeedbackReplyBody, @Req() req: JwtAuthRequest): Promise<FeedbackReply> {
    const { user } = req;
    logger.log(`save feedback reply ${r(body)}`);
    const feedbackReply = FeedbackReply.create({
      feedback: { id: body.feedbackId },
      description: body.description,
      refId: user.id,
      images: body.images,
      senderType: FeedbackSenderEnumValue.types.user,
    });
    return FeedbackReply.save(feedbackReply);
  }
}
