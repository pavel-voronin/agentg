import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ApplicationVerificationRequiredUpdate = UpdateByType<'updateApplicationVerificationRequired'>;

export function handleUpdateApplicationVerificationRequired(
  update: ApplicationVerificationRequiredUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
