import { deleteTelegramKv, upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type AgeVerificationParametersUpdate = UpdateByType<'updateAgeVerificationParameters'>;

const AGE_VERIFICATION_PARAMETERS_KEY = 'age_verification_parameters';

export async function handleUpdateAgeVerificationParameters(
  update: AgeVerificationParametersUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const parameters = update.parameters ?? null;

  if (parameters === null) {
    await deleteTelegramKv(database, AGE_VERIFICATION_PARAMETERS_KEY);
    return;
  }

  await upsertTelegramKv(database, AGE_VERIFICATION_PARAMETERS_KEY, parameters);
}
