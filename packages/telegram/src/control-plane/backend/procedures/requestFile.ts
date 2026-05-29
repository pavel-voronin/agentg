import { mutation } from '@agentg/framework';
import { z } from 'zod';

import { useFiles } from '../../../files/subsystem.js';
import {
  nonEmptyStringSchema,
  telegramFileOwnerModelRefSchema,
  telegramFileRefSchema
} from '../../../read-model/api.js';

export const fileRequestInputSchema = z.object({
  owner: telegramFileOwnerModelRefSchema,
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
  file: telegramFileRefSchema.nullable()
});

export type FileRequestInput = z.infer<typeof fileRequestInputSchema>;
export type FileRequestOutput = z.infer<typeof fileRequestOutputSchema>;

export const requestFile = mutation((procedure) =>
  procedure
    .input(fileRequestInputSchema)
    .output(fileRequestOutputSchema)
    .mutation(({ input }) => runRequestFile(input))
);

async function runRequestFile(input: FileRequestInput): Promise<FileRequestOutput> {
  const files = useFiles();
  return files.requestFile(input);
}
