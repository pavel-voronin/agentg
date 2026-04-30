import { normalizeChatNavigation } from '../domain/chatNavigation.js';
import type {
  ChatArchiveShortcutView,
  ChatFolderNavItem,
  ChatIconKind,
  ChatListHeaderView,
  ChatListItemView,
  ChatListMode,
  ChatNavigation,
  ChatSidebarView,
  ControlPlaneChat
} from '../stores/controlPlaneTypes.js';
import { formatInteger } from './formatters.js';

export type ChatSidebarViewSource = {
  chatFilter: string;
  chatFolderId: number | null;
  chatListMode: ChatListMode;
  chatNavigation: ChatNavigation;
  chats: ControlPlaneChat[];
};

export function chatSidebarView(
  source: ChatSidebarViewSource,
  selectedChatId: string | null
): ChatSidebarView {
  const search = source.chatFilter;
  const hasSearch = search.trim().length > 0;
  const header = chatListHeader(source, hasSearch);
  const chats = source.chats.map((chat) => chatListItemView(chat, selectedChatId));
  return {
    archiveShortcut: chatArchiveShortcut(source, hasSearch),
    chats,
    emptyMessage: chats.length === 0 ? chatListEmptyMessage(hasSearch) : null,
    folders: chatFolderNavItems(source),
    hasSearch,
    header,
    search
  };
}

function chatListHeader(
  source: ChatSidebarViewSource,
  hasSearch: boolean
): ChatListHeaderView | null {
  if (hasSearch) {
    return {
      kind: 'search',
      title: 'Search results across all chats'
    };
  }
  if (source.chatListMode === 'archive') {
    return {
      kind: 'archive',
      subtitle: 'All chats folder',
      title: 'Archived chats'
    };
  }
  return null;
}

function chatArchiveShortcut(
  source: ChatSidebarViewSource,
  hasSearch: boolean
): ChatArchiveShortcutView | null {
  const archiveCount = source.chatNavigation.archiveCount ?? 0;
  return !hasSearch && source.chatListMode === 'main' && archiveCount > 0
    ? { count: formatInteger(archiveCount) }
    : null;
}

function chatListEmptyMessage(hasSearch: boolean): string {
  return hasSearch ? 'No chats match this search.' : 'No chats in this list.';
}

function chatFolderNavItems(source: ChatSidebarViewSource): ChatFolderNavItem[] {
  const navigation = normalizeChatNavigation(source.chatNavigation);
  return [
    {
      active: source.chatListMode !== 'folder',
      badge: formatOptionalBadge(navigation.mainCount),
      id: 'main',
      label: 'All',
      title: 'All chats',
      type: 'main'
    },
    ...navigation.folders.map((folder) => ({
      active: source.chatListMode === 'folder' && source.chatFolderId === folder.id,
      badge: formatOptionalBadge(folder.count),
      folderId: folder.id,
      id: `folder:${String(folder.id)}`,
      label: folder.title ?? `#${String(folder.id)}`,
      title: folder.title ?? `#${String(folder.id)}`,
      type: 'folder' as const
    }))
  ];
}

function chatListItemView(chat: ControlPlaneChat, selectedChatId: string | null): ChatListItemView {
  return {
    active: chat.id === selectedChatId,
    coverageIntervals: formatInteger(chat.coverageIntervals ?? 0),
    icon: chatIcon(chat),
    id: chat.id,
    pendingJobs: formatInteger(chat.pendingJobs ?? 0),
    runningJobs: formatInteger(chat.runningJobs ?? 0),
    targets: formatInteger(chat.targets ?? 0),
    title: chat.title ?? chat.id
  };
}

function chatIcon(chat: ControlPlaneChat): ChatIconKind | null {
  if (chat.isBot === true) {
    return 'bot';
  }
  if (chat.type === 'channel' || chat.type === 'group' || chat.type === 'secret') {
    return chat.type;
  }
  return null;
}

function formatOptionalBadge(value: number | undefined): string {
  return value === undefined || value <= 0 ? '' : formatInteger(value);
}
