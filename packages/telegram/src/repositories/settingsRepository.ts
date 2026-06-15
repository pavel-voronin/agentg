import type { Database } from '../database/client.js';
import type {
  AutosaveSettings,
  NotificationSettings,
  TermsOfService,
  UserPrivacySettingRules
} from '../domain/models/settings.js';
import {
  deleteAutosaveSettings,
  replaceTermsOfService,
  saveAutosaveSettings,
  saveNotificationSettings,
  saveUserPrivacySettingRules
} from '../storage/settingsStorage.js';

export type SettingsRepository = {
  deleteAutosaveSettings(scopeKey: string): Promise<void>;
  replaceTermsOfService(terms: TermsOfService): Promise<void>;
  saveAutosaveSettings(settings: AutosaveSettings): Promise<void>;
  saveNotificationSettings(settings: NotificationSettings): Promise<void>;
  saveUserPrivacySettingRules(rules: UserPrivacySettingRules): Promise<void>;
  transaction<T>(operation: (repository: SettingsRepository) => Promise<T>): Promise<T>;
};

export function createSettingsRepository(database: Database): SettingsRepository {
  return {
    deleteAutosaveSettings(scopeKey) {
      return deleteAutosaveSettings(database, scopeKey);
    },
    replaceTermsOfService(terms) {
      return replaceTermsOfService(database, terms);
    },
    saveAutosaveSettings(settings) {
      return saveAutosaveSettings(database, settings);
    },
    saveNotificationSettings(settings) {
      return saveNotificationSettings(database, settings);
    },
    saveUserPrivacySettingRules(rules) {
      return saveUserPrivacySettingRules(database, rules);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createSettingsRepository(transaction))
      );
    }
  };
}
