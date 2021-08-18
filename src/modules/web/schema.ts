import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import * as mongoose from 'mongoose';

import type { Document } from 'mongoose';
import type { Lookup } from 'geoip-lite';

export type PageViewDocument = PageView & Document;

@ObjectType()
@Schema({ timestamps: true })
export class PageView {
  @Prop() fingerprint: string;
  @Field({ nullable: true }) @Prop() href: string;
  @Field({ nullable: true }) @Prop() title: string;
  @Prop() scid: string;
  @Field({ nullable: true }) @Prop() clientIp: string;
  @Prop() landingUrl: string;
  @Field({ nullable: true }) @Prop() referer: string;
  @Prop() origin: string;
  @Prop() sessionID: string;
  @Field({ nullable: true }) @Prop() ua: string;
  @Prop() isMobile: boolean;
  @Prop() isBrowser: boolean;
  @Prop() isUnknown: boolean;
  @Prop({ type: mongoose.Schema.Types.Mixed }) geo: Lookup;
  @Field({ nullable: true }) @Prop() address: string;
  @Field({ nullable: true }) @Prop() at: Date;
}

export const PageViewSchema = SchemaFactory.createForClass(PageView);
