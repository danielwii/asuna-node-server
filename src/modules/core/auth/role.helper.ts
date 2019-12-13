import { AccessControl } from 'accesscontrol';

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
  authority = 'authority',
}

export type ACResources = ACResourceType[];
export type ACResourceType = keyof typeof ACResource;

export class RoleHelper {
  private static accessControl: AccessControl;

  static get ac(): AccessControl {
    if (!this.accessControl) {
      this.accessControl = new AccessControl();
    }

    return this.accessControl;
  }

  // prettier-ignore
  static acInfo() {
    this.ac.grant(ACRole.SYS_ADMIN)
        .create(ACResource.authority)
        .read(ACResource.authority)
        .update(ACResource.authority)
        .delete(ACResource.authority)
      .grant(ACRole.superadmin)
        .create(ACResource.authority)
        .read(ACResource.authority)
        .update(ACResource.authority)
        .delete(ACResource.authority)
      .grant(ACRole.admin)
        .extend('user')
        .updateAny('video', ['title'])
        .deleteAny('video');
  }
}
