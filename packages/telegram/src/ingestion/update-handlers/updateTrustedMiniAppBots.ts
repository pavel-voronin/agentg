import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type TrustedMiniAppBotsUpdate = UpdateByType<'updateTrustedMiniAppBots'>;

export function handleUpdateTrustedMiniAppBots(
  update: TrustedMiniAppBotsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'trusted_mini_app_bots', update.bot_user_ids);
}
