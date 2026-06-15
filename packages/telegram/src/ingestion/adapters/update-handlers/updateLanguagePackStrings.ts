import { applyIngestionChanges } from '../../applyChanges.js';
import { languagePackStringsChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type LanguagePackStringsUpdate = UpdateByType<'updateLanguagePackStrings'>;

export async function handleUpdateLanguagePackStrings(
  update: LanguagePackStringsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, languagePackStringsChanges(update));
}
