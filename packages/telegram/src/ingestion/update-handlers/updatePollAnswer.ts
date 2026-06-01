import { replaceTelegramPollAnswerOptions } from '../../store/poll.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type PollAnswerUpdate = UpdateByType<'updatePollAnswer'>;

export async function handleUpdatePollAnswer(
  update: PollAnswerUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await replaceTelegramPollAnswerOptions(database, update);
  await events.publishTelegramPollAnswerUpdated(update);
}
