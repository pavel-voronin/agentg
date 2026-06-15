import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ApplicationRecaptchaVerificationRequiredUpdate =
  UpdateByType<'updateApplicationRecaptchaVerificationRequired'>;

export function handleUpdateApplicationRecaptchaVerificationRequired(
  update: ApplicationRecaptchaVerificationRequiredUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
