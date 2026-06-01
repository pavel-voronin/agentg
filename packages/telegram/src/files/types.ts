import type {
  ActiveNotificationModelRef,
  ChatModelRef,
  DefaultBackgroundModelRef,
  EmojiChatThemesModelRef,
  MessageModelRef,
  QuickReplyMessageModelRef,
  StickerSetModelRef,
  StoryModelRef,
  UserModelRef
} from '../model/refs.js';
import type { file } from 'tdlib-types';

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

export type FileStatus = (typeof fileStatuses)[number];
export type FileMediaKind = (typeof fileMediaKinds)[number];
export type FileRenderKind = (typeof fileRenderKinds)[number];
export type FileOwner =
  | ActiveNotificationModelRef
  | ChatModelRef
  | DefaultBackgroundModelRef
  | EmojiChatThemesModelRef
  | MessageModelRef
  | QuickReplyMessageModelRef
  | StickerSetModelRef
  | StoryModelRef
  | UserModelRef;
export type FileOwnerModel = FileOwner['_model'];
export type FileOwnerKey = {
  ownerId: string;
  ownerModel: FileOwnerModel;
};

export type ExtractedFileSlot = {
  byteSize: number | null;
  durationSeconds: number | null;
  file: file;
  fileName: string | null;
  height: number | null;
  mediaKind: FileMediaKind;
  mimeType: string | null;
  owner: FileOwner;
  renderKind: FileRenderKind;
  slotKey: string;
  tdlibFileId: number;
  width: number | null;
};

export type FileRef = {
  _model: 'telegram.file';
  byteSize: number | null;
  canRequest: boolean;
  downloadedByteSize: number | null;
  downloadError: string | null;
  durationSeconds: number | null;
  fileName: string | null;
  height: number | null;
  id: string;
  mediaKind: FileMediaKind;
  mimeType: string | null;
  owner: FileOwner;
  renderKind: FileRenderKind;
  slotKey: string;
  status: FileStatus;
  updatedAt: string;
  url: string | null;
  width: number | null;
};

export function fileRefId(input: {
  ownerModel: FileOwnerModel;
  ownerId: string;
  slotKey: string;
}): string {
  return [input.ownerModel, input.ownerId, input.slotKey].join(':');
}
