import { z } from 'zod';

import { tdlibIdSchema } from './common.js';

const tdlibUpdateDeleteMessagesInputSchema = z
  .strictObject({
    _: z.literal('updateDeleteMessages'),
    chat_id: tdlibIdSchema,
    from_cache: z.boolean(),
    is_permanent: z.boolean(),
    message_ids: z.array(tdlibIdSchema)
  })
  .transform((update) => ({
    _: update._,
    chat_id: String(update.chat_id),
    from_cache: update.from_cache,
    is_permanent: update.is_permanent,
    message_ids: update.message_ids.map(String)
  }));

export type TdlibUpdateDeleteMessages = {
  _: 'updateDeleteMessages';
  chat_id: string;
  from_cache: boolean;
  is_permanent: boolean;
  message_ids: string[];
};

export const tdlibUpdateDeleteMessagesSchema = tdlibUpdateDeleteMessagesInputSchema;

export function tdlibUpdateDeleteMessages(input: unknown): TdlibUpdateDeleteMessages {
  const update = tdlibUpdateDeleteMessagesSchema.parse(input);
  if (update.message_ids.length === 0) {
    throw new Error('TDLib updateDeleteMessages has no message ids');
  }
  return update;
}
