import type { TelegramPayload } from './payload.js';

export type NotificationSettings = {
  disableMentionNotifications: boolean;
  disablePinnedMessageNotifications: boolean;
  muteFor: number;
  muteStories: boolean;
  scopeKey: string;
  showPreview: boolean;
  showStoryPoster: boolean;
  soundId: string;
  storySoundId: string;
  useDefaultMuteStories: boolean;
};

export type AutosaveSettings = {
  autosavePhotos: boolean;
  autosaveVideos: boolean;
  maxVideoFileSize: string;
  scopeKey: string;
};

export type UserPrivacySettingRules = {
  rules: TelegramPayload;
  settingKey: string;
};

export type TermsOfService = {
  minUserAge: number;
  showPopup: boolean;
  termsOfServiceId: string;
  text: TelegramPayload;
};
