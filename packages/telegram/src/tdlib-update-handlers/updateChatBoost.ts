import { storeChatBoost } from '../telegram-store/chatBoost.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatBoostUpdate = TelegramWireUpdateByType<'updateChatBoost'>;

export async function handleUpdateChatBoost(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireChatBoostUpdate
): Promise<void> {
  await storeChatBoost(database, update);
}
