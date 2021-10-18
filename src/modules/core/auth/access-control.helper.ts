import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Access, AccessControl } from 'accesscontrol';
import _ from 'lodash';

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

    AccessControlHelper.accessControl = new AccessControl();
    // prettier-ignore
    AccessControlHelper.accessControl
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

    logger.log(
      `init ${r({
        // grants: this.accessControl.getGrants(),
        resources: AccessControlHelper.accessControl.getResources(),
        roles: AccessControlHelper.accessControl.getRoles(),
      })}`,
    );
  }

  static async filterRoles(roles: string[]): Promise<string[]> {
    return _.filter(roles, (role) => AccessControlHelper.ac.hasRole(role));
  }

  static setup(fn: (ac: AccessControl) => Access): void {
    fn(AccessControlHelper.ac);
  }

  static get ac(): AccessControl {
    if (!AccessControlHelper.accessControl) AccessControlHelper.init();
    return AccessControlHelper.accessControl;
  }

  static grantOwn() {}
}
