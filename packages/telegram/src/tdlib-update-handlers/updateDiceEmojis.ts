import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireDiceEmojisUpdate = TelegramWireUpdateByType<'updateDiceEmojis'>;

export function handleUpdateDiceEmojis(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireDiceEmojisUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'dice_emojis', update.emojis);
}
