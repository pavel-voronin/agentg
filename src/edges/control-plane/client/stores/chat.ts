import { acceptHMRUpdate, defineStore } from 'pinia';

import { normalizeChatNavigation } from '../domain/chatNavigation.js';
import {
  CONTROL_PLANE_STORAGE_KEYS,
  isPlainRecord,
  readStorage,
  writeStorage
} from './controlPlaneStorage.js';
import type { ChatListMode, ChatNavigation, ControlPlaneChat } from './controlPlaneTypes.js';

type ChatListSelection = {
  folderId: number | null;
  mode: ChatListMode;
};

type ChatStoreState = {
  chatFilter: string;
  chatFolderId: number | null;
  chatListMode: ChatListMode;
  chatNavigation: Required<ChatNavigation>;
  chats: ControlPlaneChat[];
};

export const useChatStore = defineStore('controlPlane.chats', {
  actions: {
    clearChatFilter() {
      this.chatFilter = '';
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.chatFilter, '');
    },
    hasChatFolder(folderId: number | null): boolean {
      return (
        Number.isSafeInteger(folderId) &&
        this.chatNavigation.folders.some((folder) => folder.id === folderId)
      );
    },
    selectArchiveChatList() {
      this.chatListMode = 'archive';
      this.chatFolderId = null;
      this.chatFilter = '';
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.chatFilter, '');
      writeStoredChatListSelection({ folderId: null, mode: 'main' });
    },
    selectFolderChatList(folderId: number) {
      if (!Number.isSafeInteger(folderId)) {
        return;
      }
      this.chatListMode = 'folder';
      this.chatFolderId = folderId;
      this.chatFilter = '';
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.chatFilter, '');
      writeStoredChatListSelection({ folderId, mode: 'folder' });
    },
    selectMainChatList() {
      this.chatListMode = 'main';
      this.chatFolderId = null;
      this.chatFilter = '';
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.chatFilter, '');
      writeStoredChatListSelection({ folderId: null, mode: 'main' });
    },
    setChatFilter(value: string) {
      this.chatFilter = value;
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.chatFilter, value);
    },
    setChatListData(data: { chats: ControlPlaneChat[]; navigation: ChatNavigation }) {
      this.chats = data.chats;
      this.chatNavigation = normalizeChatNavigation(data.navigation);
    }
  },
  state: (): ChatStoreState => {
    const initialChatListSelection = readStoredChatListSelection();
    return {
      chatFilter: readStorage(CONTROL_PLANE_STORAGE_KEYS.chatFilter) ?? '',
      chatFolderId: initialChatListSelection.folderId,
      chatListMode: initialChatListSelection.mode,
      chatNavigation: emptyChatNavigation(),
      chats: []
    };
  }
});

function emptyChatNavigation(): Required<ChatNavigation> {
  return {
    archiveCount: 0,
    folders: [],
    mainCount: 0
  };
}

function readStoredChatListSelection(): ChatListSelection {
  const raw = readStorage(CONTROL_PLANE_STORAGE_KEYS.chatListSelection);
  if (raw === null) {
    return { folderId: null, mode: 'main' };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isPlainRecord(parsed) &&
      parsed.mode === 'folder' &&
      Number.isSafeInteger(parsed.folderId)
    ) {
      return { folderId: parsed.folderId as number, mode: 'folder' };
    }
  } catch {
    return { folderId: null, mode: 'main' };
  }
  return { folderId: null, mode: 'main' };
}

function writeStoredChatListSelection(selection: ChatListSelection): void {
  const folderId =
    selection.mode === 'folder' && Number.isSafeInteger(selection.folderId)
      ? selection.folderId
      : null;
  writeStorage(
    CONTROL_PLANE_STORAGE_KEYS.chatListSelection,
    JSON.stringify(folderId === null ? { mode: 'main' } : { folderId, mode: 'folder' })
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot));
}
