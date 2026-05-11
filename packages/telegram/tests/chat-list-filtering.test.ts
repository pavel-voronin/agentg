import { describe, expect, it } from 'vitest';

import {
  chatMatchesListFilter,
  chatPlacementRank
} from '../src/control-plane/chatListFiltering.js';
import type { TelegramDirectoryChat } from '../src/control-plane/views.js';

describe('Telegram chat list filtering', () => {
  it('keeps archived chats out of the All list', () => {
    const archivedChat = chat({
      placements: [
        { kind: 'main', order: '100' },
        { kind: 'archive', order: '90' }
      ]
    });

    expect(chatMatchesListFilter(archivedChat, { kind: 'main' })).toBe(false);
    expect(chatMatchesListFilter(archivedChat, { kind: 'archive' })).toBe(true);
  });

  it('keeps non-archived main chats in the All list', () => {
    const mainChat = chat({
      placements: [{ kind: 'main', order: '100' }]
    });

    expect(chatMatchesListFilter(mainChat, { kind: 'main' })).toBe(true);
    expect(chatMatchesListFilter(mainChat, { kind: 'archive' })).toBe(false);
  });

  it('does not hide archived chats from their explicit folders', () => {
    const folderChat = chat({
      placements: [
        { folderId: 7, kind: 'folder', order: '80' },
        { kind: 'archive', order: '90' }
      ]
    });

    expect(chatMatchesListFilter(folderChat, { folderId: 7, kind: 'folder' })).toBe(true);
  });

  it('ranks archive before All for preferred chat list selection', () => {
    expect(chatPlacementRank({ kind: 'archive', order: '90' })).toBeLessThan(
      chatPlacementRank({ kind: 'main', order: '100' })
    );
  });
});

function chat(input: Pick<TelegramDirectoryChat, 'placements'>): TelegramDirectoryChat {
  return {
    avatar: {
      big: null,
      small: null
    },
    id: 'chat-1',
    isBot: false,
    lastMessageDate: 0,
    placements: input.placements,
    title: 'Chat',
    type: 'group',
    updatedAt: '2026-05-11T00:00:00.000Z'
  };
}
