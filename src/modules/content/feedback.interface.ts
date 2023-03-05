import { IsArray, IsOptional, IsString } from 'class-validator';

import type { JsonArray } from '@danielwii/asuna-shared';

export class FeedbackReplyBody {
  @IsArray()
  @IsOptional()
  images?: JsonArray;
  @IsString()
  description: string;
}
