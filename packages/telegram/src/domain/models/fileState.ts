import type { TelegramPayload } from './payload.js';

export type FileState = {
  expectedSize: string;
  id: number;
  local: TelegramPayload;
  remote: TelegramPayload;
  size: string | null;
};
