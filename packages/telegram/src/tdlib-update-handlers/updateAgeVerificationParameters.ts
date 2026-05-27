import { deleteTelegramKv, upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireAgeVerificationParametersUpdate =
  TelegramWireUpdateByType<'updateAgeVerificationParameters'>;

const AGE_VERIFICATION_PARAMETERS_KEY = 'age_verification_parameters';

export async function handleUpdateAgeVerificationParameters(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireAgeVerificationParametersUpdate
): Promise<void> {
  const parameters = update.parameters ?? null;

  if (parameters === null) {
    await deleteTelegramKv(database, AGE_VERIFICATION_PARAMETERS_KEY);
    return;
  }

  await upsertTelegramKv(database, AGE_VERIFICATION_PARAMETERS_KEY, parameters);
}
