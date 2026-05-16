import { z } from 'zod';

import { tdlibFileSchema, type TdlibFile } from './File.js';

const tdlibUpdateFileInputSchema = z
  .strictObject({
    _: z.literal('updateFile'),
    file: tdlibFileSchema
  })
  .transform((update) => ({
    _: update._,
    file: update.file
  }));

export type TdlibUpdateFile = {
  _: 'updateFile';
  file: TdlibFile;
};

export const tdlibUpdateFileSchema = tdlibUpdateFileInputSchema;

export function tdlibUpdateFile(input: unknown): TdlibUpdateFile {
  return tdlibUpdateFileSchema.parse(input);
}
