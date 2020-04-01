import { Column, Entity } from 'typeorm';
import { AbstractNameEntity, Publishable } from '../base';
import { EntityMetaInfo, JsonArray, MetaInfo } from '../common/decorators';
import { ColumnType } from '../core/helpers';

@EntityMetaInfo({ name: 'page__views', internal: true })
@Entity('page__t_views')
export class PageView extends Publishable(AbstractNameEntity) {
  @MetaInfo({ name: '绑定路径' })
  @Column({ nullable: false, length: 50, name: 'path' })
  path: string;

  @MetaInfo({ name: '入口文件', type: 'File' })
  @Column({ nullable: true, name: 'main_file' })
  mainFile: string;

  @MetaInfo({ name: '文件', type: 'Files' })
  @Column(ColumnType.JSON, { nullable: true, name: 'files' })
  files: JsonArray;

  @MetaInfo({ name: '图片', type: 'Images' })
  @Column(ColumnType.JSON, { nullable: true, name: 'images' })
  images: JsonArray;
}
