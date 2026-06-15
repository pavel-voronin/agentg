import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { termsOfServiceChanges } from '../settings.js';
import type { IngestionResources } from '../../resources.js';

type TermsOfServiceUpdate = UpdateByType<'updateTermsOfService'>;

export async function handleUpdateTermsOfService(
  update: TermsOfServiceUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, termsOfServiceChanges(update));
}
