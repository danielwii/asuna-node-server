import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import { fileURLToPath } from 'url';

import { LeadUser, SessionUser } from './entities';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), ClientService.name));

  /**
   * @param tenantId
   * @param projectId
   * @param visitorId session user 的 uid
   */
  public async turnToLeadUser({
    tenantId,
    projectId,
    visitorId,
  }: {
    tenantId?: string;
    projectId: string;
    visitorId: string;
  }): Promise<LeadUser> {
    const sessionUser = await SessionUser.findOne({ where: { uid: visitorId } });
    if (!sessionUser) {
      throw new Error(`session user ${visitorId} not found.`);
    }

    const user = await LeadUser.findOne({ where: { visitorId } });

    if (user) {
      return user;
      // if (user?.isLead) return user;
      //
      // user.isLead = true;
      // return user.save();
    }

    // add new user
    return LeadUser.create({ visitorId, tenantId, projectId, profileId: sessionUser.profileId }).save();
  }

  public async listLeadUsers() {
    return LeadUser.findAndCount();
  }
}
