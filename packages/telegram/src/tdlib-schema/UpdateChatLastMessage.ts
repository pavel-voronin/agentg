import type { JsonValue } from '@agentg/events/json';
import { z } from 'zod';

import { tdlibIdSchema, tdlibIdString, tdlibJsonValue } from './common.js';
import { tdlibMessage, type TdlibMessage } from './Message.js';

const tdlibUpdateChatLastMessageInputSchema = z.strictObject({
  _: z.literal('updateChatLastMessage'),
  chat_id: tdlibIdSchema,
  last_message: z.optional(z.nullable(z.unknown())),
  positions: z.optional(z.unknown())
});

type TdlibUpdateChatLastMessageInput = z.infer<typeof tdlibUpdateChatLastMessageInputSchema>;

export type TdlibUpdateChatLastMessage = {
  _: 'updateChatLastMessage';
  chatId: string;
  lastMessage: TdlibMessage | null;
  positions?: JsonValue | undefined;
};

export const tdlibUpdateChatLastMessageSchema = tdlibUpdateChatLastMessageInputSchema.transform(
  buildTdlibUpdateChatLastMessage
);

export function tdlibUpdateChatLastMessage(input: unknown): TdlibUpdateChatLastMessage {
  return tdlibUpdateChatLastMessageSchema.parse(input);
}

function buildTdlibUpdateChatLastMessage(
  update: TdlibUpdateChatLastMessageInput
): TdlibUpdateChatLastMessage {
  return {
    _: update._,
    chatId: tdlibIdString(update.chat_id) ?? '',
    lastMessage:
      update.last_message === null || update.last_message === undefined
        ? null
        : tdlibMessage(update.last_message),
    positions: tdlibJsonValue(update.positions)
  };
}
