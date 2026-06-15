import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramAutosaveSettings,
  telegramNotificationSettings,
  telegramTermsOfService,
  telegramUserPrivacySettingRules
} from '../database/schema.js';
import type {
  AutosaveSettings,
  NotificationSettings,
  TermsOfService,
  UserPrivacySettingRules
} from '../domain/models/settings.js';

export async function saveNotificationSettings(
  database: Database,
  settings: NotificationSettings
): Promise<void> {
  await database.insert(telegramNotificationSettings).values(settings).onConflictDoUpdate({
    set: settings,
    target: telegramNotificationSettings.scopeKey
  });
}

export async function saveAutosaveSettings(
  database: Database,
  settings: AutosaveSettings
): Promise<void> {
  await database.insert(telegramAutosaveSettings).values(settings).onConflictDoUpdate({
    set: settings,
    target: telegramAutosaveSettings.scopeKey
  });
}

export async function deleteAutosaveSettings(database: Database, scopeKey: string): Promise<void> {
  await database
    .delete(telegramAutosaveSettings)
    .where(eq(telegramAutosaveSettings.scopeKey, scopeKey));
}

export async function saveUserPrivacySettingRules(
  database: Database,
  rules: UserPrivacySettingRules
): Promise<void> {
  await database.insert(telegramUserPrivacySettingRules).values(rules).onConflictDoUpdate({
    set: rules,
    target: telegramUserPrivacySettingRules.settingKey
  });
}

export async function replaceTermsOfService(
  database: Database,
  terms: TermsOfService
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramTermsOfService);
    await transaction.insert(telegramTermsOfService).values(terms);
  });
}
