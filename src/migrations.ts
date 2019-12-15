import { AuthMigrations } from './modules/core/auth/auth.migrations';

export const renameTables = [
  { from: 'content__t_slides', to: 'www__t_slides' },
  { from: 'content__t_slide_categories', to: 'www__t_slide_categories' },
  { from: 'www__t_point_exchanges', to: 'property__t_point_exchanges' },
  { from: 'audit__t_recordsHide', to: 'sys__t_audit_records' },
];

export const runCustomMigrations = async (): Promise<void> => {
  await AuthMigrations.migrate();
};
