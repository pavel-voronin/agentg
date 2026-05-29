import { deleteTelegramKv, upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireAgeVerificationParametersUpdate =
  TelegramWireUpdateByType<'updateAgeVerificationParameters'>;

const AGE_VERIFICATION_PARAMETERS_KEY = 'age_verification_parameters';

export async function handleUpdateAgeVerificationParameters(
  update: TelegramWireAgeVerificationParametersUpdate
): Promise<void> {
  const database = useDatabase();
  const parameters = update.parameters ?? null;

  if (parameters === null) {
    await deleteTelegramKv(database, AGE_VERIFICATION_PARAMETERS_KEY);
    return;
  }

  await upsertTelegramKv(database, AGE_VERIFICATION_PARAMETERS_KEY, parameters);
}
