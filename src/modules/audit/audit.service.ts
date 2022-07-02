import { Logger } from '@nestjs/common';

import { diff } from 'jsondiffpatch';

import { AuditRecord, AuditType } from './audit.entities';

export class AuditService {
  public addRecord(
    type: keyof typeof AuditType,
    action: string,
    identification: { type: string; id?: number | string },
    from: object,
    to: object,
    by: any,
  ): Promise<any> {
    switch (type) {
      case 'entity':
        return identification.type !== 'AuditRecord'
          ? AuditRecord.create({
              type,
              action,
              identification,
              from: { content: from },
              to: { content: to },
              diff: diff(from, to),
              updatedBy: by,
            }).save()
          : Promise.resolve(null);
      default:
        Logger.warn(`Not implemented: ${{ type, action }}`);
        return Promise.resolve(null);
    }
  }
}
