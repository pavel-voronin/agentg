import { z } from 'zod';

import { tdlibChatSchema, type TdlibChat } from './Chat.js';

export const tdlibUpdateNewChatSchema = z.strictObject({
  _: z.literal('updateNewChat'),
  chat: tdlibChatSchema
});

export type TdlibUpdateNewChat = {
  _: 'updateNewChat';
  chat: TdlibChat;
};

export function tdlibUpdateNewChat(input: unknown): TdlibUpdateNewChat {
  return tdlibUpdateNewChatSchema.parse(input);
}
