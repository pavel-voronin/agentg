import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireAnimationSearchParametersUpdate =
  TelegramWireUpdateByType<'updateAnimationSearchParameters'>;

export function handleUpdateAnimationSearchParameters(
  update: TelegramWireAnimationSearchParametersUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'animation_search_parameters', {
    provider: update.provider,
    emojis: update.emojis
  });
}
