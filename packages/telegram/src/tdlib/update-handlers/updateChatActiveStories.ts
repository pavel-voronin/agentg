import { storeChatActiveStories } from '../../store/chatActiveStories.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireChatActiveStoriesUpdate = TelegramWireUpdateByType<'updateChatActiveStories'>;

export async function handleUpdateChatActiveStories({
  active_stories: activeStories
}: TelegramWireChatActiveStoriesUpdate): Promise<void> {
  const database = useDatabase();
  await storeChatActiveStories(database, activeStories);
}
