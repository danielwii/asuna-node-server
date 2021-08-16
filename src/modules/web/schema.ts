import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import * as mongoose from 'mongoose';

import type { Document } from 'mongoose';
import type { Lookup } from 'geoip-lite';

export type PageViewDocument = PageView & Document;

@Schema({ timestamps: true })
export class PageView {
  @Prop()
  fingerprint: string;
  @Prop()
  href: string;
  @Prop()
  title: string;
  @Prop()
  scid: string;
  @Prop()
  clientIp: string;
  @Prop()
  landingUrl: string;
  @Prop()
  referer: string;
  @Prop()
  origin: string;
  @Prop()
  sessionID: string;
  @Prop()
  ua: string;
  @Prop()
  isMobile: boolean;
  @Prop()
  isBrowser: boolean;
  @Prop()
  isUnknown: boolean;
  @Prop({ type: mongoose.Schema.Types.Mixed })
  geo: Lookup;
  @Prop()
  address: string;
  @Prop()
  at: Date;
}

export const PageViewSchema = SchemaFactory.createForClass(PageView);
