import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { NoPrimaryKeyBaseEntity } from '../base';
import { VirtualSession } from '../client';
import { EntityMetaInfo, MetaInfo } from '../common';

@EntityMetaInfo({ name: 'web_tracing_records' })
@Entity('web__t_tracing_records')
export class WebTracingRecord extends NoPrimaryKeyBaseEntity {
  // --------------------------------------------------------------
  // Optional
  // --------------------------------------------------------------

  @MetaInfo({ accessible: 'readonly', name: '来源 url' })
  @Column({ nullable: true, name: 'referer_url' })
  public refererUrl: string;

  @MetaInfo({ accessible: 'readonly', name: '着陆 url' })
  @Column({ nullable: true, name: 'landing_url' })
  public landingUrl: string;

  @MetaInfo({ accessible: 'readonly', name: '投放渠道' })
  @Column({ nullable: true, name: 'utm_source' })
  public utmSource: string;

  @MetaInfo({ accessible: 'readonly', name: '投放端' })
  @Column({ nullable: true, name: 'utm_medium' })
  public utmMedium: string;

  @MetaInfo({ accessible: 'readonly', name: '投放地区' })
  @Column({ nullable: true, name: 'utm_region' })
  public utmRegion: string;

  @MetaInfo({ accessible: 'readonly', name: '投放区域' })
  @Column({ nullable: true, name: 'utm_area' })
  public utmArea: string;

  @MetaInfo({ accessible: 'readonly', name: '投放计划' })
  @Column({ nullable: true, name: 'utm_campaign' })
  public utmCampaign: string;

  @MetaInfo({ accessible: 'readonly', name: '投放关键词' })
  @Column({ nullable: true, name: 'utm_term' })
  public utmTerm: string;

  // --------------------------------------------------------------
  // Status
  // --------------------------------------------------------------

  // --------------------------------------------------------------
  // Relations
  // --------------------------------------------------------------

  @MetaInfo({ accessible: 'hidden' })
  @PrimaryColumn({ length: 36, unique: true, name: 'session__id' })
  public sessionId: string;

  @ManyToOne('VirtualSession', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session__id' })
  public session: VirtualSession;
}
