import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';

import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';

import { Publishable } from '../base/abilities';
import { NoPrimaryKeyBaseEntity } from '../base/base.entity';
import { EntityMetaInfo, MetaInfo } from '../common/decorators/meta.decorator';
import { InjectTenant } from '../tenant/tenant.entities';

import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist/interface';

@ObjectType({ implements: () => [NoPrimaryKeyBaseEntity] })
@EntityMetaInfo({ name: 'im_projects', internal: true })
@Entity('im__t_projects')
export class Project extends Publishable(InjectTenant(NoPrimaryKeyBaseEntity)) {
  @Field()
  @PrimaryColumn({ length: 20 })
  public id: string;

  // @OneToMany('Subject', (reverse: Subject) => reverse.project)
  // subjects: Subject[];
}

export const InjectProject = <TBase extends ConstrainedConstructor<BaseEntity>>(Base: TBase) => {
  @InterfaceType()
  class ExtendableEntity extends Base {
    @Field({ nullable: true })
    @MetaInfo({ accessible: 'hidden' })
    @Column({ nullable: true, length: 20, name: 'project__id' })
    projectId?: string;

    @MetaInfo({ name: '账户' })
    @OneToOne('Project')
    @JoinColumn({ name: 'project__id' })
    project?: Project;
  }

  return ExtendableEntity;
};

/*
@EntityMetaInfo({ name: 'subjects', displayName: '公司' })
@Entity('www__t_subjects')
export class Subject extends Publishable(InjectTenant(AbstractTimeBasedBaseEntity)) {
  constructor() {
    super('s');
  }

  @MetaInfo({ accessible: 'hidden' })
  @Column({ nullable: true, length: 36, name: 'project__id' })
  projectId?: string;

  @ManyToOne('Project', (reverse: Project) => reverse.subjects, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project__id' })
  project: Project;
}
*/
