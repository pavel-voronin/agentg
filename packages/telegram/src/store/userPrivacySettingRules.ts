import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database/client.js';
import { telegramUserPrivacySettingRules } from '../database/schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireUserPrivacySettingRulesUpdate =
  TelegramWireUpdateByType<'updateUserPrivacySettingRules'>;

export async function upsertUserPrivacySettingRules(
  database: TelegramDatabase,
  update: TelegramWireUserPrivacySettingRulesUpdate
): Promise<void> {
  const row: typeof telegramUserPrivacySettingRules.$inferInsert = {
    rules: requiredTelegramWireJsonValue(update.rules),
    settingKey: update.setting._
  };

  await database.insert(telegramUserPrivacySettingRules).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUserPrivacySettingRules.settingKey
  });
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
