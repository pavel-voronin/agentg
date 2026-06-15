import type { TelegramPayload } from './payload.js';

export type KvEntry = {
  key: string;
  value: TelegramPayload;
};
