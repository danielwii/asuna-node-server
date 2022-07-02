import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import Chance from 'chance';

import { Tenant } from '../tenant/tenant.entities';
import { Project } from './entities';

const chance = new Chance();

export class ProjectHelper {
  public static async createDefaultProject(tenant: Tenant): Promise<Project> {
    const exists = await Project.findOne({ where: { tenantId: tenant.id } });
    if (exists) {
      return exists;
    }

    //
    const id = chance.string({ length: 18, symbols: false });
    const created = await Project.create({ id, tenantId: tenant.id }).save();
    Logger.log(`created default project ${r(created)}`);
    return created;
  }

  /*
  public static async createDefaultSubject(project: Project): Promise<Subject> {
    const exists = await Subject.findOne({ where: { projectId: project.id } });
    if (exists) {
      return exists;
    }

    const created = await Subject.create({ projectId: project.id, tenantId: project.tenantId }).save();
    logger.log(`created default subject ${r(created)}`);
    return created;
  }
*/

  public static loadProjectsByTenant(tenant: Tenant): Promise<Project[]> {
    return Project.find({ where: { tenantId: tenant.id } });
  }

  /*
  public static loadSubject(id: string): Promise<Subject> {
    return Subject.findOne({ where: { id } });
  }
*/
}
