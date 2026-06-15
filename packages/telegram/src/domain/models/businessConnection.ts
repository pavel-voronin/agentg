import type { TelegramPayload } from './payload.js';

export type BusinessConnection = {
  date: Date;
  id: string;
  isEnabled: boolean;
  rights: TelegramPayload;
  userChatId: string;
  userId: string;
};
