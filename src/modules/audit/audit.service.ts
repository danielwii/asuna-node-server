import { Logger } from '@nestjs/common';
import { diff } from 'jsondiffpatch';
import { AuditRecord, AuditType } from './audit.entities';

const logger = new Logger('AuditService');

export class AuditService {
  addRecord(
    type: keyof typeof AuditType,
    action: string,
    identification: { type: string; id?: number | string },
    from: object,
    to: object,
    by: any,
  ): Promise<any> {
    try {
      switch (type) {
        case 'entity':
          return identification.type !== 'AuditRecord'
            ? AuditRecord.save({
                type,
                action,
                identification,
                from: { content: from },
                to: { content: to },
                diff: diff(from, to),
                updatedBy: by,
              } as AuditRecord)
            : Promise.resolve(null);
        default:
          logger.warn(`Not implemented: ${{ type, action }}`);
          return Promise.resolve(null);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
