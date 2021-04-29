import { Column, Entity } from 'typeorm';

import { AbstractNameEntity, Publishable } from '../base';
import { EntityMetaInfo, JsonArray, MetaInfo } from '../common/decorators';
import { ColumnTypeHelper } from '../core/helpers';

@EntityMetaInfo({ name: 'page__views', internal: true })
@Entity('page__t_views')
export class PageView extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: '绑定路径' })
  @Column({ nullable: false, length: 50, name: 'path' })
  public path: string;

  @MetaInfo({ name: '入口文件', type: 'File' })
  @Column({ nullable: true, name: 'main_file' })
  public mainFile: string;

  @MetaInfo({ name: '文件', type: 'Files' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'files' })
  public files: JsonArray;

  @MetaInfo({ name: '图片', type: 'Images' })
  @Column(ColumnTypeHelper.JSON, { nullable: true, name: 'images' })
  public images: JsonArray;
}
