import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ApplicationVerificationRequiredUpdate = UpdateByType<'updateApplicationVerificationRequired'>;

export async function handleUpdateApplicationVerificationRequired(
  update: ApplicationVerificationRequiredUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramApplicationVerificationRequired(update);
}
