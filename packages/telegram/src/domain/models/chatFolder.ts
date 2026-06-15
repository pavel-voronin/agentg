import type { TelegramPayload } from './payload.js';

export type ChatFolderInfo = {
  colorId: number;
  hasMyInviteLinks: boolean;
  icon: TelegramPayload;
  id: number;
  isShareable: boolean;
  name: TelegramPayload;
  position: number;
};
