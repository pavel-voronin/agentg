import { createdMessageChanges } from '../message.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewMessageUpdate = UpdateByType<'updateNewMessage'>;

export async function handleUpdateNewMessage(
  { message }: NewMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const { recordLiveMessage } = resources.liveCoverage;

  const results = await applyIngestionChanges(resources, createdMessageChanges(message));
  const appliedChange = results.find((result) => result.applied)?.change;
  if (appliedChange === undefined) {
    return;
  }

  if (appliedChange.kind === 'message.created' && appliedChange.liveMessage !== null) {
    void recordLiveMessage(appliedChange.liveMessage.chatId, appliedChange.liveMessage.date);
  }

  await files.recordFileSlots(messageFileSlots(message), 'live_update');
}
