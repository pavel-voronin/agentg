import type { JsonValue } from '@agentg/framework';
import type { file as TdlibFile } from 'tdlib-types';

import type { ChatPhotoInfoSavedChange, DomainChange } from '../../domain/changes.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { fileStateFromTdlibFile } from './fileState.js';

type ChatPhotoUpdate = UpdateByType<'updateChatPhoto'>;
type ChatPhotoInfo = NonNullable<ChatPhotoUpdate['photo']>;

export function chatPhotoInfoChanges(update: ChatPhotoUpdate): DomainChange[] {
  const photo = update.photo ?? null;
  return [
    {
      kind: 'chatPhotoInfo.saved',
      input: {
        chat: {
          id: String(update.chat_id),
          photo: chatPhotoInfoValue(photo)
        },
        files: photo === null ? [] : [photo.small, photo.big].map(fileStateFromTdlibFile)
      }
    } satisfies ChatPhotoInfoSavedChange
  ];
}

function chatPhotoInfoValue(photo: ChatPhotoInfo | null): JsonValue {
  if (photo === null) {
    return null;
  }

  return {
    _: 'chatPhotoInfo',
    big: fileReferenceValue(photo.big),
    has_animation: photo.has_animation,
    is_personal: photo.is_personal,
    minithumbnail: tdJsonValue(photo.minithumbnail ?? null) ?? null,
    small: fileReferenceValue(photo.small)
  };
}

function fileReferenceValue(file: TdlibFile): JsonValue {
  return {
    _: 'file',
    id: file.id
  };
}
