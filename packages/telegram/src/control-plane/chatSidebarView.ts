import type {
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
  const header = chatListHeader(hasSearch);
  const chats = source.chats.map((chat) => chatListItemView(chat, selectedChatId));
  return {
    chats,
    emptyMessage: chats.length === 0 ? chatListEmptyMessage(hasSearch) : null,
    folders: chatFolderNavItems(source),
    hasSearch,
    header,
    search
  };
}

function chatListHeader(hasSearch: boolean): ChatListHeaderView | null {
  if (hasSearch) {
    return {
      kind: 'search',
      title: 'Search results across all chats'
    };
  }
  return null;
}

function chatListEmptyMessage(hasSearch: boolean): string {
  return hasSearch ? 'No chats match this search.' : 'No chats in this list.';
}

function chatFolderNavItems(source: ChatSidebarViewSource): ChatFolderNavItem[] {
  return [
    {
      active: source.chatListMode === 'main',
      badge: formatOptionalBadge(source.chatNavigation.mainCount),
      id: 'main',
      label: 'All',
      title: 'All chats',
      type: 'main'
    },
    ...source.chatNavigation.folders.map(
      (folder): ChatFolderNavItem => ({
        active: source.chatListMode === 'folder' && source.chatFolderId === folder.id,
        badge: formatOptionalBadge(folder.count),
        folderId: folder.id,
        id: `folder:${String(folder.id)}`,
        label: folder.title,
        title: folder.title,
        type: 'folder' as const
      })
    ),
    {
      active: source.chatListMode === 'archive',
      badge: formatOptionalBadge(source.chatNavigation.archiveCount),
      id: 'archive',
      label: 'Archive',
      title: 'Archive',
      type: 'archive'
    }
  ];
}

function chatListItemView(chat: ControlPlaneChat, selectedChatId: string | null): ChatListItemView {
  return {
    active: chat.id === selectedChatId,
    avatarUrl: providerFileUrl(chat.avatar.small?.url ?? chat.avatar.big?.url ?? null),
    icon: chatIcon(chat),
    id: chat.id,
    initials: chatInitials(chat.title),
    title: chat.title
  };
}

function chatInitials(title: string): string {
  const trimmed = title.trim();
  return trimmed.length === 0 ? '?' : trimmed.slice(0, 1).toLocaleUpperCase();
}

function providerFileUrl(url: string | null): string | null {
  if (!url?.startsWith('/')) {
    return null;
  }
  return `/control-plane/provider-files/telegram/${url.slice(1).split('/').map(encodeURIComponent).join('/')}`;
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
