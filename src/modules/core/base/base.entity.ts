import {
  BaseEntity,
  BeforeInsert,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MetaInfo } from '../../common/decorators';
import { SimpleIdGenerator, SimpleIdGeneratorHelper } from '../../ids';

export abstract class AbstractBaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn() id?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy?: string;
}

/**
 * 生成基于时间的 id，prefix 可以作为一个特殊的前缀用于识别不同的类型
 */
export abstract class AbstractTimeBasedBaseEntity extends BaseEntity {
  private readonly generator: SimpleIdGenerator;

  @PrimaryColumn() id?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy?: string;

  constructor(private readonly idPrefix: string = '') {
    super();
    this.generator = new SimpleIdGenerator(idPrefix);
  }

  @BeforeInsert()
  beforeInsert(): void {
    this.id = this.generator.nextId();
  }
}

export abstract class AbstractNameEntity extends AbstractBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description?: string;
}

export abstract class AbstractUUIDBaseEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid') uuid!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 100, name: 'updated_by' })
  updatedBy: string;
}

export abstract class AbstractUUIDNameEntity extends AbstractUUIDBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description: string;
}

export abstract class AbstractCategoryEntity extends AbstractBaseEntity {
  @MetaInfo({ name: '名称' })
  @Column({ nullable: false, length: 100, unique: true, name: 'name' })
  name: string;

  @MetaInfo({ name: '描述' })
  @Column('text', { nullable: true, name: 'description' })
  description: string;

  @MetaInfo({ name: '是否发布？' })
  @Column({ nullable: true, name: 'is_published' })
  isPublished: boolean;

  @MetaInfo({
    name: '是否系统数据？',
    type: 'Deletable',
    help: '系统数据无法删除',
  })
  @Column({ nullable: true, name: 'is_system' })
  isSystem: boolean;
}
