import { deleteKvEntry, saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type AgeVerificationParametersUpdate = UpdateByType<'updateAgeVerificationParameters'>;

const AGE_VERIFICATION_PARAMETERS_KEY = 'age_verification_parameters';

export async function handleUpdateAgeVerificationParameters(
  update: AgeVerificationParametersUpdate,
  resources: IngestionResources
): Promise<void> {
  const parameters = update.parameters ?? null;

  if (parameters === null) {
    await deleteKvEntry(resources, AGE_VERIFICATION_PARAMETERS_KEY);
    return;
  }

  await saveKvEntry(resources, AGE_VERIFICATION_PARAMETERS_KEY, parameters);
}
