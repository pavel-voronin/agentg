import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramUserPrivacySettingRules } from '../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../tdlib/shape.js';

type UserPrivacySettingRulesUpdate = UpdateByType<'updateUserPrivacySettingRules'>;

export async function upsertUserPrivacySettingRules(
  database: Database,
  update: UserPrivacySettingRulesUpdate
): Promise<void> {
  const row: typeof telegramUserPrivacySettingRules.$inferInsert = {
    rules: requiredJsonValue(update.rules),
    settingKey: update.setting._
  };

  await database.insert(telegramUserPrivacySettingRules).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUserPrivacySettingRules.settingKey
  });
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
