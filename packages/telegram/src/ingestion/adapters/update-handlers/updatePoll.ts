import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { pollChanges } from '../poll.js';
import type { IngestionResources } from '../../resources.js';

type PollUpdate = UpdateByType<'updatePoll'>;

export async function handleUpdatePoll(
  update: PollUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, pollChanges(update));
}
