import type { Database } from '../database/client.js';
import { telegramNotificationSettings } from '../database/schema.js';
import { type UpdateByType } from '../tdlib/value.js';

type NotificationSettingsScope = UpdateByType<'updateScopeNotificationSettings'>['scope'];
type ScopeNotificationSettings =
  UpdateByType<'updateScopeNotificationSettings'>['notification_settings'];

export async function upsertScopeNotificationSettings(
  database: Database,
  input: {
    notificationSettings: ScopeNotificationSettings;
    scope: NotificationSettingsScope;
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

export function notificationSettingsScopeKey(scope: NotificationSettingsScope): string {
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
