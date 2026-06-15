import type { TelegramPayload } from './payload.js';

export type Background = {
  document: TelegramPayload | null;
  id: string;
  isDark: boolean;
  isDefault: boolean;
  name: string;
  type: TelegramPayload;
};
