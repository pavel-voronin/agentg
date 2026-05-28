import { mutation } from '@agentg/rpc/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../../../rpc/setup.js';
import type { TelegramProcedureContext } from '../../../procedure-runtime/context.js';
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

export const requestFile = mutation((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(fileRequestInputSchema)
    .output(fileRequestOutputSchema)
    .mutation(({ input }) => runRequestFile(runtime, input))
);

async function runRequestFile(
  { files }: TelegramProcedureContext,
  input: FileRequestInput
): Promise<FileRequestOutput> {
  return files.requestFile(input);
}
