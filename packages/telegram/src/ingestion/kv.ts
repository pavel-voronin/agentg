import type { IngestionResources } from './resources.js';
import { applyIngestionChanges } from './applyChanges.js';
import { deletedKvEntryChanges, savedKvEntryChanges } from './adapters/kv.js';

export async function saveKvEntry(
  resources: IngestionResources,
  key: string,
  value: unknown
): Promise<void> {
  await applyIngestionChanges(resources, savedKvEntryChanges(key, value));
}

export async function deleteKvEntry(resources: IngestionResources, key: string): Promise<void> {
  await applyIngestionChanges(resources, deletedKvEntryChanges(key));
}
