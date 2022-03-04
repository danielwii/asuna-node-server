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
  @Prop() scid: string;
  @Prop() landingUrl: string;
  @Prop() origin: string;
  @Prop() sessionID: string;
  @Prop() isMobile: boolean;
  @Prop() isBrowser: boolean;
  @Prop() isUnknown: boolean;
  @Prop({ type: mongoose.Schema.Types.Mixed }) geo: Lookup;
  @Field({ nullable: true }) @Prop() projectId?: string;
  @Field({ nullable: true }) @Prop() href?: string;
  @Field({ nullable: true }) @Prop() title: string;
  @Field({ nullable: true }) @Prop() clientIp?: string;
  @Field({ nullable: true }) @Prop() referer?: string;
  @Field({ nullable: true }) @Prop() ua?: string;
  @Field({ nullable: true }) @Prop() address?: string;
  @Field({ nullable: true }) @Prop() at?: Date;
}

export const PageViewSchema = SchemaFactory.createForClass(PageView);
