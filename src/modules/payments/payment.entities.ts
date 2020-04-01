import { html } from 'common-tags';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { AbstractTimeBasedBaseEntity, AbstractTimeBasedNameEntity, Publishable } from '../base';
import { EntityMetaInfo, JsonArray, JsonMap, MetaInfo } from '../common/decorators';
import { InjectUserProfile } from '../core/auth';
import { ColumnType } from '../core/helpers';
import { PaymentMethodEnumValue, PaymentMethodType } from './payment.enum-values';

/**
 * 支付方式配置
 */
@EntityMetaInfo({ name: 'payment__methods', internal: true })
@Entity('payment__t_methods')
export class PaymentMethod extends Publishable(AbstractTimeBasedNameEntity) {
  constructor() {
    super('pm');
  }

  @MetaInfo({ name: '显示名称' })
  @Column({ nullable: true, name: 'display_name' })
  displayName: string;

  @MetaInfo({ name: 'Endpoint' })
  @Column({ nullable: true })
  endpoint: string;

  @MetaInfo({ name: 'Merchant ID' })
  @Column({ nullable: true })
  merchant: string;

  @MetaInfo({ name: 'API Key' })
  @Column({ nullable: true })
  apiKey: string;

  // @MetaInfo({ name: '通知 URL' })
  // @Column({ nullable: true, name: 'notify_url' })
  // notifyUrl: string;
  //
  // @MetaInfo({ name: '回掉 URL' })
  // @Column({ nullable: true, name: 'callback_url' })
  // callbackUrl: string;

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
  @Column(ColumnType.JSON, { nullable: true, name: 'extra' })
  extra: Record<string, string | number>;

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
  @Column(ColumnType.text(), { nullable: true, name: 'sign_tmpl' })
  signTmpl: string;

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
  @Column(ColumnType.text(), { nullable: true, name: 'body_tmpl' })
  bodyTmpl: string;

  @MetaInfo({ name: '支付类型', type: 'EnumFilter', enumData: PaymentMethodEnumValue.data })
  @Column('varchar', { nullable: true, name: 'status', default: PaymentMethodEnumValue.types.third })
  status: PaymentMethodType;

  @OneToMany(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    type => PaymentTransaction,
    transaction => transaction.method,
  )
  transactions: PaymentTransaction[];
}

/**
 * 支付实体信息
 */
@EntityMetaInfo({ name: 'payment__items', internal: true })
@Entity('payment__t_items')
export class PaymentItem extends Publishable(AbstractTimeBasedNameEntity) {
  constructor() {
    super('pi');
  }

  @MetaInfo({ name: 'Key' })
  @Column({ nullable: false, unique: true, length: 50, name: 'key' })
  key: string;

  @MetaInfo({ name: '简要' })
  @Column(ColumnType.text(), { nullable: true, name: 'summary' })
  summary: string;

  @MetaInfo({ name: '价格' })
  @Column(ColumnType.MONEY, { nullable: true })
  price: number;

  @MetaInfo({ name: '封面', type: 'Image' })
  @Column({ nullable: true, length: 1000 })
  cover: string;

  @MetaInfo({ name: '图片', type: 'Images' })
  @Column(ColumnType.JSON, { nullable: true })
  images: JsonArray;

  @ManyToOne(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    type => PaymentOrder,
    order => order.items,
    { onDelete: 'CASCADE' },
  )
  order: any; // PaymentOrder;
}

@EntityMetaInfo({ name: 'payment__transactions', internal: true, displayName: '交易' })
@Entity('payment__t_transactions')
export class PaymentTransaction extends InjectUserProfile(AbstractTimeBasedBaseEntity) {
  constructor() {
    super('pt');
  }

  @MetaInfo({ name: '状态' })
  @Column({ nullable: true })
  status: string;

  @MetaInfo({ name: '签名' })
  @Column({ nullable: true })
  sign: string;

  @MetaInfo({ name: '支付类型' })
  @ManyToOne(
    type => PaymentMethod,
    method => method.transactions,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'method__id' })
  method: PaymentMethod;

  @MetaInfo({ name: '附加信息' })
  @Column(ColumnType.JSON, { nullable: true })
  paymentInfo: JsonMap;

  @MetaInfo({ name: '返回信息' })
  @Column(ColumnType.JSON, { nullable: true })
  data: JsonMap;

  @MetaInfo({ name: '订单' })
  @OneToOne(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    type => PaymentOrder,
    order => order.transaction,
    { onDelete: 'CASCADE' },
  )
  order: any; // PaymentOrder;
}

@EntityMetaInfo({ name: 'payment__orders', internal: true, displayName: '订单' })
@Entity('payment__t_orders')
export class PaymentOrder extends InjectUserProfile(AbstractTimeBasedBaseEntity) {
  constructor() {
    super('po');
  }

  @MetaInfo({ name: '总金额' })
  @Column(ColumnType.MONEY, { name: 'amount' })
  amount: number;

  @MetaInfo({ name: '状态' })
  @Column({ nullable: true })
  status: string; // 订单状态

  @MetaInfo({ name: '交易' })
  @OneToOne(
    type => PaymentTransaction,
    transaction => transaction.order,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'transaction__id' })
  transaction: PaymentTransaction;

  @MetaInfo({ name: '订单内容' })
  @OneToMany(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    type => PaymentItem,
    item => item.order,
  )
  items: PaymentItem[];
}
