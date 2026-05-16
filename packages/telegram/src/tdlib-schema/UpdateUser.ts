import { z } from 'zod';

import { tdlibUserSchema, type TdlibUser } from './User.js';

export const tdlibUpdateUserSchema = z.strictObject({
  _: z.literal('updateUser'),
  user: tdlibUserSchema
});

export type TdlibUpdateUser = {
  _: 'updateUser';
  user: TdlibUser;
};

export function tdlibUpdateUser(input: unknown): TdlibUpdateUser {
  return tdlibUpdateUserSchema.parse(input);
}
