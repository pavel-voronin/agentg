import { replaceTermsOfService } from '../../store/termsOfService.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type TermsOfServiceUpdate = UpdateByType<'updateTermsOfService'>;

export async function handleUpdateTermsOfService(
  update: TermsOfServiceUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await replaceTermsOfService(database, update);
}
