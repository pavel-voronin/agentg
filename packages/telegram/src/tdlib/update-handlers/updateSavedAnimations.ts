import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireSavedAnimationsUpdate = TelegramWireUpdateByType<'updateSavedAnimations'>;

export function handleUpdateSavedAnimations(
  update: TelegramWireSavedAnimationsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'saved_animations', update.animation_ids);
}
