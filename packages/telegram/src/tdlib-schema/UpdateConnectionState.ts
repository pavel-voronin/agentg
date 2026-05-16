import { z } from 'zod';

import { tdlibJsonObject, tdlibObjectSchema, type TdlibObject } from './common.js';

const tdlibUpdateConnectionStateInputSchema = z
  .strictObject({
    _: z.literal('updateConnectionState'),
    state: tdlibObjectSchema
  })
  .transform((update) => ({
    _: update._,
    state: tdlibJsonObject(update.state)
  }));

export type TdlibUpdateConnectionState = {
  _: 'updateConnectionState';
  state: TdlibObject;
};

export const tdlibUpdateConnectionStateSchema = tdlibUpdateConnectionStateInputSchema;

export function tdlibUpdateConnectionState(input: unknown): TdlibUpdateConnectionState {
  return tdlibUpdateConnectionStateSchema.parse(input);
}
