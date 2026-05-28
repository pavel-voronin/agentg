import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireActiveEmojiReactionsUpdate =
  TelegramWireUpdateByType<'updateActiveEmojiReactions'>;

export function handleUpdateActiveEmojiReactions(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireActiveEmojiReactionsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'active_emoji_reactions', update.emojis);
}
