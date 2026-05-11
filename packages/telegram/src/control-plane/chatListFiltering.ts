import type { ChatPlacement, TelegramDirectoryChat } from './views.js';

export type ChatListKind =
  | {
      kind: 'archive';
    }
  | {
      kind: 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export function chatMatchesListFilter(chat: TelegramDirectoryChat, filter: ChatListKind): boolean {
  if (filter.kind === 'main') {
    return chatHasPlacement(chat, { kind: 'main' }) && !chatHasPlacement(chat, { kind: 'archive' });
  }
  return chat.placements.some((placement) => chatPlacementMatchesFilter(placement, filter));
}

export function chatFolderIds(chat: TelegramDirectoryChat): number[] {
  return chat.placements
    .filter((placement) => placement.kind === 'folder')
    .map((placement) => placement.folderId);
}

export function chatPlacementMatchesFilter(
  placement: ChatPlacement,
  filter: ChatListKind
): boolean {
  if (filter.kind === 'main') {
    return placement.kind === 'main';
  }
  if (filter.kind === 'archive') {
    return placement.kind === 'archive';
  }
  return placement.kind === 'folder' && placement.folderId === filter.folderId;
}

export function chatPlacementRank(placement: ChatPlacement): number {
  if (placement.kind === 'archive') {
    return 0;
  }
  if (placement.kind === 'main') {
    return 1;
  }
  return 2;
}

function chatHasPlacement(chat: TelegramDirectoryChat, filter: ChatListKind): boolean {
  return chat.placements.some((placement) => chatPlacementMatchesFilter(placement, filter));
}
