import type { TelegramChatModelRef, TelegramMessageModelRef } from './modelRefs.js';
import type { TelegramWireFile } from './telegramWire.js';

export const telegramFileStatuses = ['known', 'queued', 'downloading', 'ready', 'failed'] as const;
export const telegramFileMediaKinds = [
  'avatar',
  'document',
  'photo',
  'thumbnail',
  'video',
  'voice'
] as const;
export const telegramFileRenderKinds = ['audio', 'download', 'image', 'video'] as const;

export type TelegramFileStatus = (typeof telegramFileStatuses)[number];
export type TelegramFileMediaKind = (typeof telegramFileMediaKinds)[number];
export type TelegramFileRenderKind = (typeof telegramFileRenderKinds)[number];
export type TelegramFileOwner = TelegramChatModelRef | TelegramMessageModelRef;
export type TelegramFileOwnerModel = TelegramFileOwner['_model'];
export type TelegramFileOwnerKey = {
  ownerId: string;
  ownerModel: TelegramFileOwnerModel;
};

export type ExtractedTelegramFileSlot = {
  byteSize: number | null;
  durationSeconds: number | null;
  file: TelegramWireFile;
  fileName: string | null;
  height: number | null;
  mediaKind: TelegramFileMediaKind;
  mimeType: string | null;
  owner: TelegramFileOwner;
  renderKind: TelegramFileRenderKind;
  slotKey: string;
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
