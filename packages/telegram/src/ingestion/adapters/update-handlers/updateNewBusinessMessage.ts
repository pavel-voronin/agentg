import { applyIngestionChanges } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import { createdBusinessMessageChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewBusinessMessageUpdate = UpdateByType<'updateNewBusinessMessage'>;

export async function handleUpdateNewBusinessMessage(
  update: NewBusinessMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const { recordLiveMessage } = resources.liveCoverage;
  const message = update.message.message;

  await applyIngestionChanges(resources, createdBusinessMessageChanges(update));

  await files.recordFileSlots(messageFileSlots(message), 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordFileSlots(messageFileSlots(replyToMessage), 'live_update');
  }

  if (message.date > 0) {
    void recordLiveMessage(String(message.chat_id), new Date(message.date * 1000));
  }
}
