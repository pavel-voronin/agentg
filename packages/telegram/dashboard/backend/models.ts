import { z } from 'zod';

import { fileOwnerModelRefSchema, fileRefSchema } from '../../src/domain/models/fileRef.js';
import { messageSchema } from '../../src/domain/models/message.js';
import { nonEmptyStringSchema } from '../../src/domain/models/scalars.js';
import {
  getMessagesInputSchema,
  getMessagesOutputSchema
} from '../../src/procedures/get-messages/contract.js';
import {
  chatDirectoryInputSchema,
  chatDirectorySchema as chatDirectoryOutputSchema,
  chatDirectoryEntrySchema,
  chatFolderSchema,
  chatLastMessageSchema,
  chatTypeCountSchema,
  type ChatDirectoryEntry,
  type ChatFolder,
  type ChatTypeCount
} from '../../src/domain/models/chatDirectory.js';

export { getMessagesInputSchema, getMessagesOutputSchema };
export {
  chatDirectoryEntrySchema,
  chatDirectoryInputSchema,
  chatDirectoryOutputSchema,
  chatFolderSchema,
  chatLastMessageSchema,
  chatTypeCountSchema
};

export const messageLookupInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  messageId: nonEmptyStringSchema
});

export const messageLookupOutputSchema = z.object({
  message: messageSchema.nullable()
});

export const fileRequestInputSchema = z.object({
  owner: fileOwnerModelRefSchema,
  slotKey: nonEmptyStringSchema
});

export const fileRequestOutputSchema = z.object({
  decision: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('record'),
      reason: z.string()
    }),
    z.object({
      action: z.literal('enqueue'),
      reason: z.string()
    }),
    z.object({
      action: z.literal('deny'),
      reason: z.string()
    })
  ]),
  file: fileRefSchema.nullable()
});

export type { ChatDirectoryEntry, ChatFolder, ChatTypeCount };
