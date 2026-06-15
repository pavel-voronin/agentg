import type { TelegramPayload } from './payload.js';

export type ChatPhoto = {
  addedDate: Date;
  animation: TelegramPayload;
  id: string;
  minithumbnail: TelegramPayload;
  sizes: TelegramPayload;
  smallAnimation: TelegramPayload;
  sticker: TelegramPayload;
};
