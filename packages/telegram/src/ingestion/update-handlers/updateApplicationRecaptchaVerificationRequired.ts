import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ApplicationRecaptchaVerificationRequiredUpdate =
  UpdateByType<'updateApplicationRecaptchaVerificationRequired'>;

export async function handleUpdateApplicationRecaptchaVerificationRequired(
  update: ApplicationRecaptchaVerificationRequiredUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramApplicationRecaptchaVerificationRequired(update);
}
