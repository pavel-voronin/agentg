import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatReplyMarkupChanges } from '../chat.js';
import { messageFileSlots } from '../fileSlot.js';
import type { IngestionResources } from '../../resources.js';

type ChatReplyMarkupUpdate = UpdateByType<'updateChatReplyMarkup'>;

export async function handleUpdateChatReplyMarkup(
  update: ChatReplyMarkupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const replyMarkupMessage = update.reply_markup_message ?? null;
  await applyIngestionChanges(resources, chatReplyMarkupChanges(update));

  if (replyMarkupMessage !== null) {
    await files.recordFileSlots(messageFileSlots(replyMarkupMessage), 'live_update');
  }
}
