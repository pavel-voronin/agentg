import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramTermsOfService } from '../schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireTermsOfServiceUpdate = TelegramWireUpdateByType<'updateTermsOfService'>;

export async function replaceTermsOfService(
  database: TelegramDatabase,
  update: TelegramWireTermsOfServiceUpdate
): Promise<void> {
  const termsOfService = update.terms_of_service;
  const row: typeof telegramTermsOfService.$inferInsert = {
    minUserAge: termsOfService.min_user_age,
    showPopup: termsOfService.show_popup,
    termsOfServiceId: update.terms_of_service_id,
    text: requiredTelegramWireJsonValue(termsOfService.text)
  };

  await database.transaction(async (transaction) => {
    await transaction.delete(telegramTermsOfService);
    await transaction.insert(telegramTermsOfService).values(row);
  });
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
