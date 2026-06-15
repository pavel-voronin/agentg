import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type TrustedMiniAppBotsUpdate = UpdateByType<'updateTrustedMiniAppBots'>;

export function handleUpdateTrustedMiniAppBots(
  update: TrustedMiniAppBotsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'trusted_mini_app_bots', update.bot_user_ids);
}
