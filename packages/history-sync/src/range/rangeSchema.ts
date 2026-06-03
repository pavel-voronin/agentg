import { z } from 'zod';

export const nonEmptyStringSchema = z.string().trim().min(1);
export const isoDateTimeStringSchema = z.iso.datetime();

export const historySyncBoundarySchema = z.discriminatedUnion('kind', [
  z.object({
    at: nonEmptyStringSchema,
    kind: z.literal('absolute')
  }),
  z.object({
    expression: nonEmptyStringSchema,
    kind: z.literal('expression')
  })
]);

export const historySyncRangeSchema = z.object({
  end: historySyncBoundarySchema,
  start: historySyncBoundarySchema
});
