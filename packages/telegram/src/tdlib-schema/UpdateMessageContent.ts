import { z } from 'zod';

import {
  tdlibDate,
  tdlibIdSchema,
  tdlibJsonObject,
  tdlibObjectSchema,
  type TdlibObject
} from './common.js';

const tdlibUpdateMessageContentInputSchema = z
  .strictObject({
    _: z.literal('updateMessageContent'),
    chat_id: tdlibIdSchema,
    edit_date: z.optional(z.number()),
    message_id: tdlibIdSchema,
    new_content: tdlibObjectSchema
  })
  .transform((update) => ({
    _: update._,
    chat_id: String(update.chat_id),
    message_id: String(update.message_id),
    new_content: tdlibJsonObject(update.new_content),
    ...(tdlibDate(update.edit_date) === undefined ? {} : { edit_date: tdlibDate(update.edit_date) })
  }));

export type TdlibUpdateMessageContent = {
  _: 'updateMessageContent';
  chat_id: string;
  edit_date?: Date | undefined;
  message_id: string;
  new_content: TdlibObject;
};

export const tdlibUpdateMessageContentSchema = tdlibUpdateMessageContentInputSchema;

export function tdlibUpdateMessageContent(input: unknown): TdlibUpdateMessageContent {
  return tdlibUpdateMessageContentSchema.parse(input);
}
