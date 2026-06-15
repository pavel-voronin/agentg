import { replaceTelegramPoll } from '../../store/poll.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type PollUpdate = UpdateByType<'updatePoll'>;

export async function handleUpdatePoll(
  update: PollUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await replaceTelegramPoll(database, update.poll);
}
