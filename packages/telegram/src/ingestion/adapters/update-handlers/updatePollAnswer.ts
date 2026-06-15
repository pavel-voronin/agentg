import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { pollAnswerChanges } from '../poll.js';
import type { IngestionResources } from '../../resources.js';

type PollAnswerUpdate = UpdateByType<'updatePollAnswer'>;

export async function handleUpdatePollAnswer(
  update: PollAnswerUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, pollAnswerChanges(update));
}
