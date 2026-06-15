import type { TelegramPayload } from './payload.js';

export type StickerSet = {
  emojis: TelegramPayload;
  id: string;
  isAllowedAsChatEmojiStatus: boolean;
  isArchived: boolean;
  isInstalled: boolean;
  isOfficial: boolean;
  isOwned: boolean;
  isViewed: boolean;
  name: string;
  needsRepainting: boolean;
  stickerType: TelegramPayload;
  stickers: TelegramPayload;
  thumbnail: TelegramPayload;
  thumbnailOutline: TelegramPayload;
  title: string;
};

export type Sticker = {
  emoji: string | null | undefined;
  fileId: number;
  format: TelegramPayload;
  fullType: TelegramPayload;
  height: number;
  id: string | null;
  setId: string | null;
  thumbnail: TelegramPayload;
  width: number;
};
