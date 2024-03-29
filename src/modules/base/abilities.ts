import { Field, InterfaceType } from '@nestjs/graphql';

import { MetaInfo } from '@danielwii/asuna-shared';

import { BaseEntity, Column, DeleteDateColumn } from 'typeorm';

import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist/interface';

export const Publishable = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @Field()
    @MetaInfo({ name: '是否发布？' })
    @Column({ nullable: true, name: 'is_published' })
    public isPublished: boolean;
  }

  return ExtendableEntity;
};

export const SoftDelete = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @MetaInfo({ name: '删除时间' })
    @DeleteDateColumn({ name: 'deleted_at' })
    public deletedAt?: Date;
  }

  return ExtendableEntity;
};

export const Featuredable = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @Field()
    @MetaInfo({ name: '是否推荐？' })
    @Column({ nullable: true, name: 'is_featured' })
    public isFeatured: boolean;
  }

  return ExtendableEntity;
};

export const NameDescAttachable = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @Field()
    @MetaInfo({ name: '名称' })
    @Column({ nullable: false, length: 100, unique: true, name: 'name' })
    public name: string;

    @Field({ nullable: true })
    @MetaInfo({ name: '描述' })
    @Column('text', { nullable: true, name: 'description' })
    public description?: string;
  }
  return ExtendableEntity;
};
