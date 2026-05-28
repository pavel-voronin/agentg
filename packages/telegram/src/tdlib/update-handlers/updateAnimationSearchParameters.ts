import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireAnimationSearchParametersUpdate =
  TelegramWireUpdateByType<'updateAnimationSearchParameters'>;

export function handleUpdateAnimationSearchParameters(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireAnimationSearchParametersUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'animation_search_parameters', {
    provider: update.provider,
    emojis: update.emojis
  });
}
