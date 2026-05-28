import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireTrustedMiniAppBotsUpdate = TelegramWireUpdateByType<'updateTrustedMiniAppBots'>;

export function handleUpdateTrustedMiniAppBots(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireTrustedMiniAppBotsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'trusted_mini_app_bots', update.bot_user_ids);
}
