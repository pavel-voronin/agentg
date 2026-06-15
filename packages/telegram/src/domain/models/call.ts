import type { TelegramPayload } from './payload.js';

export type Call = {
  id: number;
  isOutgoing: boolean;
  isVideo: boolean;
  state: TelegramPayload;
  uniqueId: string;
  userId: string;
};
