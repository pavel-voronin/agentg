import { applyIngestionChanges } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import { savedBusinessMessageChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewBusinessCallbackQueryUpdate = UpdateByType<'updateNewBusinessCallbackQuery'>;

export async function handleUpdateNewBusinessCallbackQuery(
  update: NewBusinessCallbackQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, savedBusinessMessageChanges(update));

  await files.recordFileSlots(messageFileSlots(update.message.message), 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordFileSlots(messageFileSlots(replyToMessage), 'live_update');
  }
}
