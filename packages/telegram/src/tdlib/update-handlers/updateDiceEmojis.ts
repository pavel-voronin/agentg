import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireDiceEmojisUpdate = TelegramWireUpdateByType<'updateDiceEmojis'>;

export function handleUpdateDiceEmojis(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireDiceEmojisUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'dice_emojis', update.emojis);
}
