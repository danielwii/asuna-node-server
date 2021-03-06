import { BaseEntity, Column } from 'typeorm';

import { MetaInfo } from '../common/decorators';

export type Constructor = new (...args: any[]) => {};
export type ConstrainedConstructor<T = {}> = new (...args: any[]) => T;

export const Publishable = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ name: '是否发布？' })
    @Column({ nullable: true, name: 'is_published' })
    public isPublished: boolean;
  }

  return ExtendableEntity;
};

export const Featuredable = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ name: '是否推荐？' })
    @Column({ nullable: true, name: 'is_featured' })
    public isFeatured: boolean;
  }

  return ExtendableEntity;
};

export const NameDescAttachable = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  class ExtendableEntity extends Base {
    @MetaInfo({ name: '名称' })
    @Column({ nullable: false, length: 100, unique: true, name: 'name' })
    public name: string;

    @MetaInfo({ name: '描述' })
    @Column('text', { nullable: true, name: 'description' })
    public description: string;
  }
  return ExtendableEntity;
};
