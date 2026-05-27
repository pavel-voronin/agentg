import { storeSupergroup } from '../telegram-store/supergroup.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireSupergroupUpdate } from '../telegramWire.js';

export async function handleUpdateSupergroup(
  { database }: TelegramUpdateHandlerContext,
  { supergroup }: TelegramWireSupergroupUpdate
): Promise<void> {
  await storeSupergroup(database, supergroup);
}
