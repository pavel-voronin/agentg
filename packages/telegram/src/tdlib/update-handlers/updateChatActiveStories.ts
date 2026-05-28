import { storeChatActiveStories } from '../../store/chatActiveStories.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatActiveStoriesUpdate = TelegramWireUpdateByType<'updateChatActiveStories'>;

export async function handleUpdateChatActiveStories(
  { database }: TelegramUpdateHandlerContext,
  { active_stories: activeStories }: TelegramWireChatActiveStoriesUpdate
): Promise<void> {
  await storeChatActiveStories(database, activeStories);
}
