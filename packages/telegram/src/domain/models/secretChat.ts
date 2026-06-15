import type { TelegramPayload } from './payload.js';

export type SecretChatState = {
  id: number;
  isOutbound: boolean;
  keyHash: string;
  layer: number;
  state: TelegramPayload;
  userId: string;
};
