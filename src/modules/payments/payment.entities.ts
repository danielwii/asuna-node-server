import { Field, ObjectType } from '@nestjs/graphql';

import { html } from 'common-tags';
import * as scalars from 'graphql-scalars';
import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany, OneToOne } from 'typeorm';

import { AbstractTimeBasedBaseEntity, AbstractTimeBasedNameEntity, Publishable } from '../base';
import { EntityMetaInfo, JsonArray, MetaInfo } from '@danielwii/asuna-shared';
import { InjectMultiUserProfile } from '../core/auth';
import { ColumnTypeHelper } from '../core/helpers';
import { PaymentMethodEnumValue, PaymentMethodType } from './payment.enum-values';
// eslint-disable-next-line import/no-cycle
import { PaymentOrder } from './payment.order.entities';

/**
 * 支付方式配置
 */
@ObjectType()
@EntityMetaInfo({ name: 'payment__methods', internal: true })
@Entity('payment__t_methods')
export class PaymentMethod extends Publishable(AbstractTimeBasedNameEntity) {
  public constructor() {
    super('pm');
  }

  @Field()
  @MetaInfo({ name: '显示名称' })
  @Column({ nullable: true, name: 'display_name' })
  public displayName: string;

  @Field()
  @MetaInfo({ name: 'Endpoint' })
  @Column({ nullable: true })
  public endpoint: string;

  @Field()
  @MetaInfo({ name: 'Merchant ID' })
  @Column({ nullable: true })
  public merchant: string;

  // @Expose({ name: 'with-api-key', toPlainOnly: true })
  @Field()
  @MetaInfo({ name: 'API Key' })
  @Column({ nullable: true })
  public apiKey: string;

  // @Expose({ name: 'with-private-key', toPlainOnly: true })
  @Field()
  @MetaInfo({ name: 'Private Key' })
  @Column(ColumnTypeHelper.text(), { nullable: true, name: 'private_key' })
  public privateKey: string;

  @Field((returns) => scalars.GraphQLJSONObject)
  @MetaInfo({
    name: '附加信息',
    type: 'JSON',
    help: html`
      <ul>
        <li>method: string = GET 手动发送</li>
        <li>lowercase: boolean = true 签名大小写，默认大写</li>
        <li>remoteSign: string = 'sign' 回掉签名位置</li>
        <li>query: string = 'http://xxx.endpoint' 查询地址</li>
        <li>queryBody: stringTmpl = '{}' 查询消息模版</li>
      </ul>
    `,
  })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'extra' })
  public extra: Record<string, string | number>;

  @Field()
  @MetaInfo({
    name: '签名模版',
    type: 'StringTmpl',
    fields: [
      { name: 'order.id', fake: 'random.number' },
      { name: 'order.amount', fake: 'finance.amount' },
      { name: 'createdAt', fake: 'date.past' },
      { name: 'callback', fake: 'internet.url' },
      { name: 'notify', fake: 'internet.url' },
      { name: 'method.apiKey', fake: 'internet.password' },
      { name: 'method.merchant', fake: 'finance.account' },
      { name: 'method.extra', help: '自定义附加信息' },
    ],
  })
  @Column(ColumnTypeHelper.text(), { nullable: true, name: 'sign_tmpl' })
  public signTmpl: string;

  @Field()
  @MetaInfo({
    name: 'Body 模版',
    type: 'StringTmpl',
    fields: [
      { name: 'order.id', fake: 'random.number' },
      { name: 'order.amount', fake: 'finance.amount' },
      { name: 'createdAt', fake: 'date.past' },
      { name: 'callback', fake: 'internet.url' },
      { name: 'notify', fake: 'internet.url' },
      { name: 'method.apiKey', fake: 'internet.password' },
      { name: 'method.merchant', fake: 'finance.account' },
      { name: 'method.extra', help: '自定义附加信息' },
      { name: 'md5sign', fake: 'finance.iban' },
    ],
    // extra: { jsonMode: true },
  })
  @Column(ColumnTypeHelper.text(), { nullable: true, name: 'body_tmpl' })
  public bodyTmpl: string;

  @MetaInfo({ name: '支付类型', type: 'EnumFilter', enumData: PaymentMethodEnumValue.data })
  @Column('varchar', { nullable: true, name: 'type', default: PaymentMethodEnumValue.types.third })
  public type: PaymentMethodType;

  @OneToMany('PaymentTransaction', (inverse: PaymentTransaction) => inverse.method)
  public transactions: PaymentTransaction[];
}

/**
 * 支付实体信息
 */
@ObjectType()
@EntityMetaInfo({ name: 'payment__items', internal: true })
@Entity('payment__t_items')
export class PaymentItem extends Publishable(AbstractTimeBasedNameEntity) {
  public constructor() {
    super('pi');
  }

  @Field()
  @MetaInfo({ name: 'Key' })
  @Column({ nullable: false, unique: true, length: 50, name: 'key' })
  public key: string;

  @Field()
  @MetaInfo({ name: '简要' })
  @Column(ColumnTypeHelper.text(), { nullable: true, name: 'summary' })
  public summary: string;

  @Field()
  @MetaInfo({ name: '价格' })
  @Column({ ...ColumnTypeHelper.money(), nullable: true })
  public price: number;

  @Field()
  @MetaInfo({ name: '封面', type: 'Image' })
  @Column({ nullable: true, length: 1000 })
  public cover: string;

  @Field((returns) => scalars.GraphQLJSON)
  @MetaInfo({ name: '图片', type: 'Images' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public images: JsonArray;

  @Field((returns) => [PaymentOrder])
  @ManyToMany('PaymentOrder', (inverse: PaymentOrder) => inverse.items)
  public orders: PaymentOrder[];
}

@ObjectType()
@EntityMetaInfo({ name: 'payment__transactions', internal: true, displayName: '交易' })
@Entity('payment__t_transactions')
export class PaymentTransaction extends InjectMultiUserProfile(AbstractTimeBasedBaseEntity) {
  public constructor() {
    super('pt');
  }

  @Field()
  @MetaInfo({ name: '状态' })
  @Column({ nullable: true })
  public status: string;

  @Field()
  @MetaInfo({ name: '签名' })
  @Column({ nullable: true })
  public sign: string;

  @Field((returns) => scalars.GraphQLJSONObject)
  @MetaInfo({ name: '支付相关信息' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'payment_info' })
  public paymentInfo: Record<string, unknown>;

  @Field((returns) => scalars.GraphQLJSONObject)
  @MetaInfo({ name: '附加信息' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public extra: Record<string, unknown>;

  @Field((returns) => scalars.GraphQLJSONObject)
  @MetaInfo({ name: '返回信息' })
  @Column(ColumnTypeHelper.JSON, { nullable: true })
  public data: Record<string, unknown>;

  @Field((returns) => PaymentMethod)
  @MetaInfo({ name: '支付类型' })
  @ManyToOne('PaymentMethod', (inverse: PaymentMethod) => inverse.transactions, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'method__id' })
  public method: PaymentMethod;

  @Field((returns) => PaymentOrder)
  @MetaInfo({ name: '订单' })
  @OneToOne('PaymentOrder', (inverse: PaymentOrder) => inverse.transaction, { onDelete: 'CASCADE' })
  public order: PaymentOrder;
}
