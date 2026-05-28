import { storeChatBoost } from '../../store/chatBoost.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatBoostUpdate = TelegramWireUpdateByType<'updateChatBoost'>;

export async function handleUpdateChatBoost(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireChatBoostUpdate
): Promise<void> {
  await storeChatBoost(database, update);
}
