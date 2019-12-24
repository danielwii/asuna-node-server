import { Access, AccessControl } from 'accesscontrol';

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
  draft = 'draft',
}

export type ACResources = ACResourceType[];
export type ACResourceType = keyof typeof ACResource;

export class AccessControlHelper {
  private static accessControl: AccessControl;

  static init(): void {
    if (this.accessControl) {
      return;
    }

    this.accessControl = new AccessControl();
    // prettier-ignore
    this.accessControl
      .grant(ACRole.SYS_ADMIN)
        .create(ACResource.authority)
        .read(ACResource.authority)
        .update(ACResource.authority)
        .delete(ACResource.authority)
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
