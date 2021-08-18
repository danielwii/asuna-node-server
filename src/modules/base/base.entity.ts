import { Field, ID, InterfaceType, ObjectType } from '@nestjs/graphql';

import {
  AfterLoad,
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { MetaInfo } from '../common/decorators';
import { fixTZ } from '../core/helpers/entity.helper';
import { SimpleIdGenerator } from '../ids';
import { NameDescAttachable, Publishable } from './abilities';

export type ExtendBaseEntity<ExtendType> = BaseEntity & ExtendType;
export type EntityObject<Entity> = Omit<
  Entity,
  'recover' | 'reload' | 'preSave' | 'beforeInsert' | 'afterLoad' | 'idPrefix' | 'generator' | 'of' | 'hasId'
>;
export type EntityConstructorObject<Entity> = Omit<
  Entity,
  keyof typeof BaseEntity | 'recover' | 'reload' | 'preSave' | 'beforeInsert' | 'afterLoad' | 'idPrefix' | 'generator'
>;

@InterfaceType()
export class NoPrimaryKeyBaseEntity extends BaseEntity {
  @Field()
  @Index()
  @CreateDateColumn({ name: 'created_at' })
  public createdAt?: Date;

  @Field()
  @Index()
  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  public updatedBy?: string;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'created_by' })
  public createdBy?: string;

  @AfterLoad()
  public afterLoad(): void {
    fixTZ(this);
  }
}

@InterfaceType()
export class AbstractBaseEntity extends NoPrimaryKeyBaseEntity {
  @Field((returns) => ID)
  @PrimaryGeneratedColumn()
  public id?: number;
}

/**
 * 生成基于时间的 id，prefix 可以作为一个特殊的前缀用于识别不同的类型
 */
@InterfaceType()
export class AbstractTimeBasedBaseEntity extends BaseEntity {
  readonly #idPrefix: string;
  readonly #generator: SimpleIdGenerator;

  @Field((returns) => ID)
  @PrimaryColumn('varchar', { length: 36 })
  public id?: string;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  public createdAt?: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  public updatedBy?: string;

  public constructor(idPrefix = '') {
    super();
    this.#idPrefix = idPrefix;
    this.#generator = new SimpleIdGenerator(idPrefix);
  }

  @BeforeInsert()
  public beforeInsert(): void {
    if (!this.id) this.id = this.#generator.nextId();
  }

  @AfterLoad()
  public afterLoad(): void {
    fixTZ(this);
  }
}

@InterfaceType({ implements: () => [AbstractTimeBasedBaseEntity] })
export class AbstractTimeBasedNameEntity extends NameDescAttachable(AbstractTimeBasedBaseEntity) {}

@InterfaceType({ implements: () => [AbstractBaseEntity] })
export class AbstractNameEntity extends NameDescAttachable(AbstractBaseEntity) {}

export class AbstractUUIDBaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') public uuid!: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  public updatedBy: string;

  @AfterLoad()
  public afterLoad(): void {
    fixTZ(this);
  }
}

export class AbstractUUIDNameEntity extends NameDescAttachable(AbstractUUIDBaseEntity) {}

/**
 * really not recommended
 */
export class AbstractUUID2BaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') public id!: string;

  @CreateDateColumn({ name: 'created_at' })
  public createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  public updatedAt: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  public updatedBy: string;

  @AfterLoad()
  public afterLoad(): void {
    fixTZ(this);
  }
}

export class AbstractUUID2NameEntity extends NameDescAttachable(AbstractUUID2BaseEntity) {}

@InterfaceType({ implements: () => [AbstractBaseEntity] })
export class AbstractCategoryEntity extends Publishable(NameDescAttachable(AbstractBaseEntity)) {
  @MetaInfo({ name: '是否系统数据？', type: 'Deletable', help: '系统数据无法删除' })
  @Column({ nullable: true, name: 'is_system' })
  public isSystem: boolean;
}
