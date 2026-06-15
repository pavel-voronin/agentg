import type { TelegramPayload } from './payload.js';

export type QuickReplyMessageState = {
  canBeEdited: boolean;
  content: TelegramPayload;
  id: string;
  mediaAlbumId: string | null;
  order: number;
  replyMarkup: TelegramPayload;
  replyToMessageId: string | null;
  sendingState: TelegramPayload;
  shortcutId: number;
  viaBotUserId: string;
};

export type QuickReplyShortcut = {
  firstMessageId: string;
  id: number;
  messageCount: number;
  name: string;
};
