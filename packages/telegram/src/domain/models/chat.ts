import { z } from 'zod';

import { fileRefSchema } from './fileRef.js';
import { isoDateTimeStringSchema } from './scalars.js';

export const chatSchema = z.object({
  _model: z.literal('telegram.chat'),
  avatar: z.object({
    big: fileRefSchema.nullable(),
    small: fileRefSchema.nullable()
  }),
  id: z.string(),
  title: z.string(),
  type: z.string(),
  updatedAt: isoDateTimeStringSchema
});

export type Chat = z.infer<typeof chatSchema>;
