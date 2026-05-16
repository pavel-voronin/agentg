import { z } from 'zod';

import { tdlibMessageSchema, type TdlibMessage } from './Message.js';

export const tdlibUpdateNewMessageSchema = z.strictObject({
  _: z.literal('updateNewMessage'),
  message: tdlibMessageSchema
});

export type TdlibUpdateNewMessage = {
  _: 'updateNewMessage';
  message: TdlibMessage;
};

export function tdlibUpdateNewMessage(input: unknown): TdlibUpdateNewMessage {
  return tdlibUpdateNewMessageSchema.parse(input);
}
