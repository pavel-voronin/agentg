import { z } from 'zod';

const tdlibLocalFileInputSchema = z.strictObject({
  _: z.literal('localFile'),
  can_be_deleted: z.boolean(),
  can_be_downloaded: z.boolean(),
  download_offset: z.number().int(),
  downloaded_prefix_size: z.number().int(),
  downloaded_size: z.number().int(),
  is_downloading_active: z.boolean(),
  is_downloading_completed: z.boolean(),
  path: z.string()
});

const tdlibRemoteFileInputSchema = z.strictObject({
  _: z.literal('remoteFile'),
  id: z.string(),
  is_uploading_active: z.boolean(),
  is_uploading_completed: z.boolean(),
  unique_id: z.string(),
  uploaded_size: z.number().int()
});

const tdlibFileInputSchema = z.strictObject({
  _: z.literal('file'),
  expected_size: z.number().int(),
  id: z.number().int(),
  local: tdlibLocalFileInputSchema,
  remote: tdlibRemoteFileInputSchema,
  size: z.number().int()
});

export type TdlibLocalFile = z.infer<typeof tdlibLocalFileInputSchema>;
export type TdlibRemoteFile = z.infer<typeof tdlibRemoteFileInputSchema>;
export type TdlibFile = z.infer<typeof tdlibFileInputSchema>;

export const tdlibLocalFileSchema = tdlibLocalFileInputSchema;
export const tdlibRemoteFileSchema = tdlibRemoteFileInputSchema;
export const tdlibFileSchema = tdlibFileInputSchema;

export function tdlibLocalFile(input: unknown): TdlibLocalFile {
  return tdlibLocalFileSchema.parse(input);
}

export function tdlibRemoteFile(input: unknown): TdlibRemoteFile {
  return tdlibRemoteFileSchema.parse(input);
}

export function tdlibFile(input: unknown): TdlibFile {
  return tdlibFileSchema.parse(input);
}

export function tdlibFileOrUndefined(input: unknown): TdlibFile | undefined {
  const parsed = tdlibFileSchema.safeParse(input);
  return parsed.success ? parsed.data : undefined;
}
