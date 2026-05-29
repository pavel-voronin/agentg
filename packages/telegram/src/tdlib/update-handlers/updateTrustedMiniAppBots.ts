import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireTrustedMiniAppBotsUpdate = TelegramWireUpdateByType<'updateTrustedMiniAppBots'>;

export function handleUpdateTrustedMiniAppBots(
  update: TelegramWireTrustedMiniAppBotsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'trusted_mini_app_bots', update.bot_user_ids);
}
