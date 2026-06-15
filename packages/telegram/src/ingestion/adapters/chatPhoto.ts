import type { file as TdlibFile } from 'tdlib-types';

import type { ChatPhoto } from '../../domain/models/chatPhoto.js';
import type { FileState } from '../../domain/models/fileState.js';
import { tdJsonValue } from '../../tdlib/shape.js';
import { fileStateFromTdlibFile } from './fileState.js';

export type TdlibChatPhotoSource = {
  added_date: number;
  animation?: { file: TdlibFile } | null;
  id: string;
  minithumbnail?: unknown;
  sizes: { photo: TdlibFile }[];
  small_animation?: { file: TdlibFile } | null;
  sticker?: unknown;
};

export function chatPhotoFromTdlibChatPhoto(photo: TdlibChatPhotoSource): ChatPhoto {
  return {
    addedDate: new Date(photo.added_date * 1000),
    animation: requiredJsonValue(photo.animation ?? null),
    id: photo.id,
    minithumbnail: requiredJsonValue(photo.minithumbnail ?? null),
    sizes: requiredJsonValue(photo.sizes),
    smallAnimation: requiredJsonValue(photo.small_animation ?? null),
    sticker: requiredJsonValue(photo.sticker ?? null)
  };
}

export function fileStatesFromTdlibChatPhoto(photo: TdlibChatPhotoSource): FileState[] {
  return chatPhotoFiles(photo).map(fileStateFromTdlibFile);
}

function chatPhotoFiles(photo: TdlibChatPhotoSource): TdlibFile[] {
  const animation = photo.animation ?? null;
  const smallAnimation = photo.small_animation ?? null;

  return [
    ...photo.sizes.map((size) => size.photo),
    ...(animation === null ? [] : [animation.file]),
    ...(smallAnimation === null ? [] : [smallAnimation.file])
  ];
}

function requiredJsonValue(value: unknown) {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
