import { z } from 'zod';

import { tdlibJsonObject, tdlibObjectSchema, type TdlibObject } from './common.js';

const tdlibUpdateAuthorizationStateInputSchema = z
  .strictObject({
    _: z.literal('updateAuthorizationState'),
    authorization_state: tdlibObjectSchema
  })
  .transform((update) => ({
    _: update._,
    authorization_state: tdlibJsonObject(update.authorization_state)
  }));

export type TdlibUpdateAuthorizationState = {
  _: 'updateAuthorizationState';
  authorization_state: TdlibObject;
};

export const tdlibUpdateAuthorizationStateSchema = tdlibUpdateAuthorizationStateInputSchema;

export function tdlibUpdateAuthorizationState(input: unknown): TdlibUpdateAuthorizationState {
  return tdlibUpdateAuthorizationStateSchema.parse(input);
}
