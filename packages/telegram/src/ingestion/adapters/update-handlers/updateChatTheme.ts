import { applyIngestionChanges } from '../../applyChanges.js';
import { chatThemeChanges } from '../background.js';
import { chatThemeFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatThemeUpdate = UpdateByType<'updateChatTheme'>;

export async function handleUpdateChatTheme(
  update: ChatThemeUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const chatId = String(update.chat_id);
  const theme = update.theme ?? null;

  await applyIngestionChanges(resources, chatThemeChanges(update));
  await files.recordFileSlots(chatThemeFileSlots(chatId, theme), 'live_update');
}
