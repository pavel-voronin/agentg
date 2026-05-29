import { storeSupergroup } from '../../store/supergroup.js';
import type { TelegramWireSupergroupUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

export async function handleUpdateSupergroup({
  supergroup
}: TelegramWireSupergroupUpdate): Promise<void> {
  const database = useDatabase();
  await storeSupergroup(database, supergroup);
}
