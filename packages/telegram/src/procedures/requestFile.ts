import { z } from 'zod';

import { fileOwnerModelRefSchema, fileRefSchema } from '../domain/models/fileRef.js';
import { nonEmptyStringSchema } from '../domain/models/scalars.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  owner: fileOwnerModelRefSchema,
  slotKey: nonEmptyStringSchema
});

const outputSchema = z.object({
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

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function requestFileProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runRequestFile(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

function runRequestFile(input: Input, resources: ProcedureResources): Promise<Output> {
  return resources.files.requestFile(input);
}
