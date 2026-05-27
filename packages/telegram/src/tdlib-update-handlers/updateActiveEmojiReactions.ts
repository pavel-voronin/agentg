import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireActiveEmojiReactionsUpdate =
  TelegramWireUpdateByType<'updateActiveEmojiReactions'>;

export function handleUpdateActiveEmojiReactions(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireActiveEmojiReactionsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'active_emoji_reactions', update.emojis);
}
