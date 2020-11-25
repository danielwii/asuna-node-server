import { Promise } from 'bluebird';
import { AuthMigrations } from './modules/core/auth/auth.migrations';

export const renameTables = [
  { from: 'sys__t_tenants', to: 'sass__t_tenants' },
  { from: 'sys__t_virtual_devices', to: 'client__t_virtual_devices' },
  { from: 'sys__t_virtual_sessions', to: 'client__t_virtual_sessions' },
  { from: 'auth__t_user_profiles', to: 'user__profiles' },
  { from: 'im__t_timeline_session_users', to: 'client__t_session_users' },
];

export const runCustomMigrations = async (migrations: any[]): Promise<void> => {
  await AuthMigrations.migrate();

  await Promise.each(migrations ?? [], (migration) => migration.migrate());
};
