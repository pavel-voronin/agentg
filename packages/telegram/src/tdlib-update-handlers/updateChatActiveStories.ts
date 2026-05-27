import { storeChatActiveStories } from '../telegram-store/chatActiveStories.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatActiveStoriesUpdate = TelegramWireUpdateByType<'updateChatActiveStories'>;

export async function handleUpdateChatActiveStories(
  { database }: TelegramUpdateHandlerContext,
  { active_stories: activeStories }: TelegramWireChatActiveStoriesUpdate
): Promise<void> {
  await storeChatActiveStories(database, activeStories);
}
