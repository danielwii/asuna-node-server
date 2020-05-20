import {
  AfterLoad,
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MetaInfo } from '../common/decorators/meta.decorator';
import { fixTZ } from '../core/helpers/entity.helper';
import { SimpleIdGenerator } from '../ids';
import { Publishable } from './abilities';

export type ExtendBaseEntity<ExtendType> = BaseEntity & ExtendType;
export type EntityConstructorObject<Entity> = Omit<
  Entity,
  keyof typeof BaseEntity | 'recover' | 'reload' | 'preSave' | 'beforeInsert' | 'afterLoad' | 'idPrefix' | 'generator'
>;

export class AbstractBaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn() id?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy?: string;

  @AfterLoad()
  afterLoad(): void {
    fixTZ(this);
  }
}

/**
 * 生成基于时间的 id，prefix 可以作为一个特殊的前缀用于识别不同的类型
 */
export class AbstractTimeBasedBaseEntity extends BaseEntity {
  readonly #idPrefix: string;
  readonly #generator: SimpleIdGenerator;

  @PrimaryColumn({ length: 36 }) id?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy?: string;

  constructor(idPrefix: string = '') {
    super();
    this.#idPrefix = idPrefix;
    this.#generator = new SimpleIdGenerator(idPrefix);
  }

  @BeforeInsert()
  beforeInsert(): void {
    if (!this.id) this.id = this.#generator.nextId();
  }

  @AfterLoad()
  afterLoad(): void {
    fixTZ(this);
  }
}

export class AbstractTimeBasedNameEntity extends AbstractTimeBasedBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description?: string;
}

export class AbstractNameEntity extends AbstractBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description?: string;
}

export class AbstractUUIDBaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') uuid!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy: string;

  @AfterLoad()
  afterLoad(): void {
    fixTZ(this);
  }
}

export class AbstractUUIDNameEntity extends AbstractUUIDBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description: string;
}

export class AbstractUUID2BaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy: string;

  @AfterLoad()
  afterLoad(): void {
    fixTZ(this);
  }
}

export class AbstractUUID2NameEntity extends AbstractUUID2BaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description: string;
}

export class AbstractCategoryEntity extends Publishable(AbstractBaseEntity) {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description: string;

  @MetaInfo({
    name: '是否系统数据？',
    type: 'Deletable',
    help: '系统数据无法删除',
  })
  @Column({ nullable: true, name: 'is_system' })
  isSystem: boolean;
}
