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
} from './views.js';

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
  const archiveCount = source.chatNavigation.archiveCount;
  return !hasSearch && source.chatListMode === 'main' && archiveCount > 0
    ? { count: formatInteger(archiveCount) }
    : null;
}

function chatListEmptyMessage(hasSearch: boolean): string {
  return hasSearch ? 'No chats match this search.' : 'No chats in this list.';
}

function chatFolderNavItems(source: ChatSidebarViewSource): ChatFolderNavItem[] {
  return [
    {
      active: source.chatListMode !== 'folder',
      badge: formatOptionalBadge(source.chatNavigation.mainCount),
      id: 'main',
      label: 'All',
      title: 'All chats',
      type: 'main'
    },
    ...source.chatNavigation.folders.map((folder) => ({
      active: source.chatListMode === 'folder' && source.chatFolderId === folder.id,
      badge: formatOptionalBadge(folder.count),
      folderId: folder.id,
      id: `folder:${String(folder.id)}`,
      label: folder.title,
      title: folder.title,
      type: 'folder' as const
    }))
  ];
}

function chatListItemView(chat: ControlPlaneChat, selectedChatId: string | null): ChatListItemView {
  return {
    active: chat.id === selectedChatId,
    coverageIntervals: formatInteger(chat.coverageIntervals),
    icon: chatIcon(chat),
    id: chat.id,
    pendingJobs: formatInteger(chat.pendingJobs),
    runningJobs: formatInteger(chat.runningJobs),
    targets: formatInteger(chat.targets),
    title: chat.title
  };
}

function chatIcon(chat: ControlPlaneChat): ChatIconKind | null {
  if (chat.isBot) {
    return 'bot';
  }
  if (chat.type === 'channel' || chat.type === 'group' || chat.type === 'secret') {
    return chat.type;
  }
  return null;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatOptionalBadge(value: number | undefined): string {
  return value === undefined || value <= 0 ? '' : formatInteger(value);
}
