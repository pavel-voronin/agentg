import type { TelegramDatabase } from '../database/client.js';
import { telegramNotificationSettings } from '../database/schema.js';
import type { TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireNotificationSettingsScope =
  TelegramWireUpdateByType<'updateScopeNotificationSettings'>['scope'];
type TelegramWireScopeNotificationSettings =
  TelegramWireUpdateByType<'updateScopeNotificationSettings'>['notification_settings'];

export async function upsertScopeNotificationSettings(
  database: TelegramDatabase,
  input: {
    notificationSettings: TelegramWireScopeNotificationSettings;
    scope: TelegramWireNotificationSettingsScope;
  }
): Promise<string> {
  const scopeKey = notificationSettingsScopeKey(input.scope);
  const settings = input.notificationSettings;
  const row: typeof telegramNotificationSettings.$inferInsert = {
    disableMentionNotifications: settings.disable_mention_notifications,
    disablePinnedMessageNotifications: settings.disable_pinned_message_notifications,
    muteFor: settings.mute_for,
    muteStories: settings.mute_stories,
    scopeKey,
    showPreview: settings.show_preview,
    showStoryPoster: settings.show_story_poster,
    soundId: settings.sound_id,
    storySoundId: settings.story_sound_id,
    useDefaultMuteStories: settings.use_default_mute_stories
  };

  await database.insert(telegramNotificationSettings).values(row).onConflictDoUpdate({
    set: row,
    target: telegramNotificationSettings.scopeKey
  });

  return scopeKey;
}

export function notificationSettingsScopeKey(scope: TelegramWireNotificationSettingsScope): string {
  const scopeType: string = scope._;

  if (scopeType === 'notificationSettingsScopePrivateChats') {
    return 'private_chats';
  }
  if (scopeType === 'notificationSettingsScopeGroupChats') {
    return 'group_chats';
  }
  if (scopeType === 'notificationSettingsScopeChannelChats') {
    return 'channel_chats';
  }
  throw new Error('Unsupported notification settings scope');
}
