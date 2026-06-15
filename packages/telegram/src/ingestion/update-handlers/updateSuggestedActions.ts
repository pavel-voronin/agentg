import { applySuggestedActionsDelta } from '../../store/suggestedAction.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SuggestedActionsUpdate = UpdateByType<'updateSuggestedActions'>;

export async function handleUpdateSuggestedActions(
  update: SuggestedActionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await applySuggestedActionsDelta(database, update);
}
