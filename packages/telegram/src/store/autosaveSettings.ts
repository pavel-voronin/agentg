import { eq } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { telegramAutosaveSettings } from '../schema.js';
import type { TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireAutosaveSettingsUpdate = TelegramWireUpdateByType<'updateAutosaveSettings'>;
type TelegramWireAutosaveSettingsScope = TelegramWireAutosaveSettingsUpdate['scope'];
type TelegramWireScopeAutosaveSettings = NonNullable<
  TelegramWireAutosaveSettingsUpdate['settings']
>;

export type StoreAutosaveSettingsResult = {
  hasSettings: boolean;
  scopeKey: string;
};

export async function storeAutosaveSettings(
  database: TelegramDatabase,
  update: TelegramWireAutosaveSettingsUpdate
): Promise<StoreAutosaveSettingsResult> {
  const scopeKey = autosaveSettingsScopeKey(update.scope);
  const settings = update.settings ?? null;

  if (settings === null) {
    await database
      .delete(telegramAutosaveSettings)
      .where(eq(telegramAutosaveSettings.scopeKey, scopeKey));
    return { hasSettings: false, scopeKey };
  }

  const row = autosaveSettingsRow(scopeKey, settings);
  await database.insert(telegramAutosaveSettings).values(row).onConflictDoUpdate({
    set: row,
    target: telegramAutosaveSettings.scopeKey
  });

  return { hasSettings: true, scopeKey };
}

function autosaveSettingsRow(
  scopeKey: string,
  settings: TelegramWireScopeAutosaveSettings
): typeof telegramAutosaveSettings.$inferInsert {
  return {
    autosavePhotos: settings.autosave_photos,
    autosaveVideos: settings.autosave_videos,
    maxVideoFileSize: String(settings.max_video_file_size),
    scopeKey
  };
}

function autosaveSettingsScopeKey(scope: TelegramWireAutosaveSettingsScope): string {
  switch (scope._) {
    case 'autosaveSettingsScopePrivateChats':
      return 'private_chats';
    case 'autosaveSettingsScopeGroupChats':
      return 'group_chats';
    case 'autosaveSettingsScopeChannelChats':
      return 'channel_chats';
    case 'autosaveSettingsScopeChat':
      return `chat:${String(scope.chat_id)}`;
  }

  return assertNeverAutosaveSettingsScope(scope);
}

function assertNeverAutosaveSettingsScope(scope: never): never {
  throw new Error(`Unsupported autosave settings scope: ${(scope as { _: string })._}`);
}
