import { Access, AccessControl } from 'accesscontrol';
import * as _ from 'lodash';

import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { DBHelper } from '../db';

export enum ACRole {
  // 系统预留
  SYS_ADMIN = 'SYS_ADMIN',
  // 超级管理员
  superadmin = 'superadmin',
  // 普通管理员
  admin = 'admin',
}

export type ACRoles = ACRoleType[];
export type ACRoleType = keyof typeof ACRole;

export enum ACResource {
  authority = '#authority',
  draft = '#draft',
}

export type ACResources = ACResourceType[];
export type ACResourceType = keyof typeof ACResource;

const logger = LoggerFactory.getLogger('AccessControlHelper');

export class AccessControlHelper {
  private static accessControl: AccessControl;

  static init(): void {
    if (this.accessControl) {
      return;
    }

    const entities = DBHelper.loadMetadatas().map<string>((metadata) => _.get(metadata.target, 'entityInfo.name'));

    this.accessControl = new AccessControl();
    // prettier-ignore
    this.accessControl
      .grant(ACRole.SYS_ADMIN)
        .create([ACResource.authority, ...entities])
        .read([ACResource.authority, ...entities])
        .update([ACResource.authority, ...entities])
        .delete([ACResource.authority, ...entities])
      .grant(ACRole.superadmin)
        .create(ACResource.authority)
        .read(ACResource.authority)
        .update(ACResource.authority)
        .delete(ACResource.authority)
      .grant(ACRole.admin).extend(ACRole.superadmin)
    // .extend('user')
    // .updateAny('video', ['title'])
    // .deleteAny('video')
    ;

    logger.log(`init ${r({ resources: this.accessControl.getResources(), roles: this.accessControl.getRoles() })}`);
  }

  static setup(fn: (ac: AccessControl) => Access): void {
    fn(this.ac);
  }

  static get ac(): AccessControl {
    if (!this.accessControl) this.init();
    return this.accessControl;
  }

  static grantOwn() {}
}
