import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireSavedAnimationsUpdate = TelegramWireUpdateByType<'updateSavedAnimations'>;

export function handleUpdateSavedAnimations(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedAnimationsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'saved_animations', update.animation_ids);
}
