import type { JsonObject } from '@agentg/events/json';

import type { TelegramChatModelRef, TelegramMessageModelRef } from './model-refs.js';

export const telegramFileStatuses = ['known', 'queued', 'downloading', 'ready', 'failed'] as const;
export const telegramFileMediaKinds = [
  'avatar',
  'document',
  'photo',
  'thumbnail',
  'video'
] as const;
export const telegramFileRenderKinds = ['download', 'image', 'video'] as const;

export type TelegramFileStatus = (typeof telegramFileStatuses)[number];
export type TelegramFileMediaKind = (typeof telegramFileMediaKinds)[number];
export type TelegramFileRenderKind = (typeof telegramFileRenderKinds)[number];
export type TelegramFileOwner = TelegramChatModelRef | TelegramMessageModelRef;
export type TelegramFileOwnerModel = TelegramFileOwner['_model'];

export type TelegramFileSource = JsonObject & {
  kind: 'tdlibFile';
  localPath?: string;
  fileId: number;
  remoteId?: string;
  remoteUniqueId?: string;
};

export type ExtractedTelegramFileSlot = {
  byteSize: number | null;
  durationSeconds: number | null;
  fileName: string | null;
  height: number | null;
  mediaKind: TelegramFileMediaKind;
  mimeType: string | null;
  owner: TelegramFileOwner;
  renderKind: TelegramFileRenderKind;
  slotKey: string;
  source: TelegramFileSource;
  tdlibFileId: number;
  width: number | null;
};

export type TelegramFileRef = {
  _model: 'telegram.file';
  byteSize: number | null;
  canRequest: boolean;
  downloadedByteSize: number | null;
  downloadError: string | null;
  durationSeconds: number | null;
  fileName: string | null;
  height: number | null;
  id: string;
  mediaKind: TelegramFileMediaKind;
  mimeType: string | null;
  owner: TelegramFileOwner;
  renderKind: TelegramFileRenderKind;
  slotKey: string;
  status: TelegramFileStatus;
  updatedAt: string;
  url: string | null;
  width: number | null;
};

export function telegramFileRefId(input: {
  ownerModel: TelegramFileOwnerModel;
  ownerId: string;
  slotKey: string;
}): string {
  return [input.ownerModel, input.ownerId, input.slotKey].join(':');
}
