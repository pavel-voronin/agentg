import { applyIngestionChanges } from '../../applyChanges.js';
import { suggestedActionsChanges } from '../suggestedAction.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type SuggestedActionsUpdate = UpdateByType<'updateSuggestedActions'>;

export async function handleUpdateSuggestedActions(
  update: SuggestedActionsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, suggestedActionsChanges(update));
}
