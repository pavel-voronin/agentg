import { z } from 'zod';

import { isoDateTimeStringSchema, nonNegativeIntegerSchema } from './scalars.js';

export const fileStatuses = ['known', 'queued', 'downloading', 'ready', 'failed'] as const;
export const fileMediaKinds = [
  'avatar',
  'document',
  'photo',
  'thumbnail',
  'video',
  'voice'
] as const;
export const fileRenderKinds = ['audio', 'download', 'image', 'video'] as const;

export const chatModelRefSchema = z.object({
  _model: z.literal('telegram.chat'),
  id: z.string()
});

export const defaultBackgroundModelRefSchema = z.object({
  _model: z.literal('telegram.defaultBackground'),
  id: z.string()
});

export const emojiChatThemesModelRefSchema = z.object({
  _model: z.literal('telegram.emojiChatThemes'),
  id: z.string()
});

export const activeNotificationModelRefSchema = z.object({
  _model: z.literal('telegram.activeNotification'),
  id: z.string()
});

export const messageModelRefSchema = z.object({
  _model: z.literal('telegram.message'),
  id: z.string()
});

export const quickReplyMessageModelRefSchema = z.object({
  _model: z.literal('telegram.quickReplyMessage'),
  id: z.string()
});

export const stickerSetModelRefSchema = z.object({
  _model: z.literal('telegram.stickerSet'),
  id: z.string()
});

export const storyModelRefSchema = z.object({
  _model: z.literal('telegram.story'),
  id: z.string()
});

export const userModelRefSchema = z.object({
  _model: z.literal('telegram.user'),
  id: z.string()
});

export const fileOwnerModelRefSchema = z.discriminatedUnion('_model', [
  activeNotificationModelRefSchema,
  chatModelRefSchema,
  defaultBackgroundModelRefSchema,
  emojiChatThemesModelRefSchema,
  messageModelRefSchema,
  quickReplyMessageModelRefSchema,
  stickerSetModelRefSchema,
  storyModelRefSchema,
  userModelRefSchema
]);

export const fileRefSchema = z.object({
  _model: z.literal('telegram.file'),
  byteSize: nonNegativeIntegerSchema.nullable(),
  canRequest: z.boolean(),
  downloadedByteSize: nonNegativeIntegerSchema.nullable(),
  downloadError: z.string().nullable(),
  durationSeconds: nonNegativeIntegerSchema.nullable(),
  fileName: z.string().nullable(),
  height: nonNegativeIntegerSchema.nullable(),
  id: z.string(),
  mediaKind: z.enum(fileMediaKinds),
  mimeType: z.string().nullable(),
  owner: fileOwnerModelRefSchema,
  renderKind: z.enum(fileRenderKinds),
  slotKey: z.string(),
  status: z.enum(fileStatuses),
  updatedAt: isoDateTimeStringSchema,
  url: z.string().nullable(),
  width: nonNegativeIntegerSchema.nullable()
});

export type FileStatus = (typeof fileStatuses)[number];
export type FileMediaKind = (typeof fileMediaKinds)[number];
export type FileRenderKind = (typeof fileRenderKinds)[number];
export type FileOwner = z.infer<typeof fileOwnerModelRefSchema>;
export type FileOwnerModel = FileOwner['_model'];
export type FileOwnerKey = {
  ownerId: string;
  ownerModel: FileOwnerModel;
};
export type FileRef = z.infer<typeof fileRefSchema>;

export function fileRefId(input: {
  ownerModel: FileOwnerModel;
  ownerId: string;
  slotKey: string;
}): string {
  return [input.ownerModel, input.ownerId, input.slotKey].join(':');
}
