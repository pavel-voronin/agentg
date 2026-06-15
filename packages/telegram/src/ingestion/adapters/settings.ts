import type { JsonValue } from '@agentg/framework';

import type {
  AutosaveSettingsDeletedChange,
  AutosaveSettingsSavedChange,
  DomainChange,
  NotificationSettingsSavedChange,
  TermsOfServiceReplacedChange,
  UserPrivacySettingRulesSavedChange
} from '../../domain/changes.js';
import type {
  AutosaveSettings,
  NotificationSettings,
  TermsOfService,
  UserPrivacySettingRules
} from '../../domain/models/settings.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type ScopeNotificationSettingsUpdate = UpdateByType<'updateScopeNotificationSettings'>;
type NotificationSettingsScope = ScopeNotificationSettingsUpdate['scope'];
type AutosaveSettingsUpdate = UpdateByType<'updateAutosaveSettings'>;
type AutosaveSettingsScope = AutosaveSettingsUpdate['scope'];
type ScopeAutosaveSettings = NonNullable<AutosaveSettingsUpdate['settings']>;
type UserPrivacySettingRulesUpdate = UpdateByType<'updateUserPrivacySettingRules'>;
type TermsOfServiceUpdate = UpdateByType<'updateTermsOfService'>;

export function notificationSettingsChanges(
  update: ScopeNotificationSettingsUpdate
): DomainChange[] {
  return [
    {
      kind: 'notificationSettings.saved',
      settings: notificationSettingsRecord(update)
    } satisfies NotificationSettingsSavedChange
  ];
}

export function autosaveSettingsChanges(update: AutosaveSettingsUpdate): DomainChange[] {
  const scopeKey = autosaveSettingsScopeKey(update.scope);
  const settings = update.settings ?? null;
  if (settings === null) {
    return [
      {
        kind: 'autosaveSettings.deleted',
        scopeKey
      } satisfies AutosaveSettingsDeletedChange
    ];
  }

  return [
    {
      kind: 'autosaveSettings.saved',
      settings: autosaveSettingsRecord(scopeKey, settings)
    } satisfies AutosaveSettingsSavedChange
  ];
}

export function userPrivacySettingRulesChanges(
  update: UserPrivacySettingRulesUpdate
): DomainChange[] {
  return [
    {
      kind: 'userPrivacySettingRules.saved',
      rules: userPrivacySettingRulesRecord(update)
    } satisfies UserPrivacySettingRulesSavedChange
  ];
}

export function termsOfServiceChanges(update: TermsOfServiceUpdate): DomainChange[] {
  return [
    {
      kind: 'termsOfService.replaced',
      terms: termsOfServiceRecord(update)
    } satisfies TermsOfServiceReplacedChange
  ];
}

function notificationSettingsRecord(update: ScopeNotificationSettingsUpdate): NotificationSettings {
  const settings = update.notification_settings;
  return {
    disableMentionNotifications: settings.disable_mention_notifications,
    disablePinnedMessageNotifications: settings.disable_pinned_message_notifications,
    muteFor: settings.mute_for,
    muteStories: settings.mute_stories,
    scopeKey: notificationSettingsScopeKey(update.scope),
    showPreview: settings.show_preview,
    showStoryPoster: settings.show_story_poster,
    soundId: settings.sound_id,
    storySoundId: settings.story_sound_id,
    useDefaultMuteStories: settings.use_default_mute_stories
  };
}

function notificationSettingsScopeKey(scope: NotificationSettingsScope): string {
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

function autosaveSettingsRecord(
  scopeKey: string,
  settings: ScopeAutosaveSettings
): AutosaveSettings {
  return {
    autosavePhotos: settings.autosave_photos,
    autosaveVideos: settings.autosave_videos,
    maxVideoFileSize: String(settings.max_video_file_size),
    scopeKey
  };
}

function autosaveSettingsScopeKey(scope: AutosaveSettingsScope): string {
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

function userPrivacySettingRulesRecord(
  update: UserPrivacySettingRulesUpdate
): UserPrivacySettingRules {
  return {
    rules: requiredJsonValue(update.rules),
    settingKey: update.setting._
  };
}

function termsOfServiceRecord(update: TermsOfServiceUpdate): TermsOfService {
  const termsOfService = update.terms_of_service;
  return {
    minUserAge: termsOfService.min_user_age,
    showPopup: termsOfService.show_popup,
    termsOfServiceId: update.terms_of_service_id,
    text: requiredJsonValue(termsOfService.text)
  };
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
