import { IsArray, IsOptional, IsString } from 'class-validator';
import { JsonArray } from '../common/decorators';

export class FeedbackReplyBody {
  @IsArray()
  @IsOptional()
  images?: JsonArray;
  @IsString()
  description: string;
}
