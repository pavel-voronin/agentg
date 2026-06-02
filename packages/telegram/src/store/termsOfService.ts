import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramTermsOfService } from '../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../tdlib/value.js';

type TermsOfServiceUpdate = UpdateByType<'updateTermsOfService'>;

export async function replaceTermsOfService(
  database: Database,
  update: TermsOfServiceUpdate
): Promise<void> {
  const termsOfService = update.terms_of_service;
  const row: typeof telegramTermsOfService.$inferInsert = {
    minUserAge: termsOfService.min_user_age,
    showPopup: termsOfService.show_popup,
    termsOfServiceId: update.terms_of_service_id,
    text: requiredJsonValue(termsOfService.text)
  };

  await database.transaction(async (transaction) => {
    await transaction.delete(telegramTermsOfService);
    await transaction.insert(telegramTermsOfService).values(row);
  });
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
