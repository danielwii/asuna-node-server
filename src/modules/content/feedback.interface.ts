import { IsArray, IsOptional, IsString } from 'class-validator';

import type { JsonArray } from '../common/decorators';

export class FeedbackReplyBody {
  @IsArray()
  @IsOptional()
  images?: JsonArray;
  @IsString()
  description: string;
}
