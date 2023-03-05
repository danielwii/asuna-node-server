import _ from 'lodash';
import { Entity } from 'typeorm';

import { AbstractTimeBasedNameEntity } from '../base';
import { EntityMetaInfo } from '@danielwii/asuna-shared';

@EntityMetaInfo({ name: 'content__data_groups', internal: true })
@Entity('content__t_data_groups')
export class DataGroup extends _.flow()(AbstractTimeBasedNameEntity) {}
