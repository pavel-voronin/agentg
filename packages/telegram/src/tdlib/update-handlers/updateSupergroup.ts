import { storeSupergroup } from '../../store/supergroup.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireSupergroupUpdate } from '../wire.js';

export async function handleUpdateSupergroup(
  { database }: TelegramUpdateHandlerContext,
  { supergroup }: TelegramWireSupergroupUpdate
): Promise<void> {
  await storeSupergroup(database, supergroup);
}
