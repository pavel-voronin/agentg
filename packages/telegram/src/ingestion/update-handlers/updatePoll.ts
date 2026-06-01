import { replaceTelegramPoll } from '../../store/poll.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type PollUpdate = UpdateByType<'updatePoll'>;

export async function handleUpdatePoll(
  update: PollUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await replaceTelegramPoll(database, update.poll);
  await events.publishTelegramPollUpdated(update);
}
