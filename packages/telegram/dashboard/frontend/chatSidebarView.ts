import type {
  ChatFolderAccentIcon,
  ChatFolderNavItem,
  ChatIconKind,
  ChatListHeaderView,
  ChatListItemView,
  ChatListMode,
  ChatPlacement,
  ChatNavigation,
  ChatSidebarView,
  DashboardChat
} from './views.js';

export type ChatSidebarViewSource = {
  chatFilter: string;
  chatFolderId: number | null;
  chatListMode: ChatListMode;
  chatNavigation: ChatNavigation;
  chats: DashboardChat[];
};

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function chatSidebarView(
  source: ChatSidebarViewSource,
  selectedChatId: string | null
): ChatSidebarView {
  const search = source.chatFilter;
  const hasSearch = search.trim().length > 0;
  const header = chatListHeader(hasSearch);
  const chats = source.chats.map((chat) => chatListItemView(chat, selectedChatId, source));
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
      badge: folderBadge(
        source.chatNavigation.mainUnreadCount,
        source.chatNavigation.mainMutedUnreadCount
      ),
      badgeTone: folderBadgeTone(
        source.chatNavigation.mainUnreadCount,
        source.chatNavigation.mainMutedUnreadCount
      ),
      id: 'main',
      icon: 'chats',
      iconAccent: null,
      label: 'All',
      title: 'All chats',
      type: 'main'
    },
    ...source.chatNavigation.folders.map(
      (folder): ChatFolderNavItem => ({
        active: source.chatListMode === 'folder' && source.chatFolderId === folder.id,
        badge: folderBadge(folder.unreadCount, folder.mutedUnreadCount),
        badgeTone: folderBadgeTone(folder.unreadCount, folder.mutedUnreadCount),
        folderId: folder.id,
        id: `folder:${String(folder.id)}`,
        icon: 'folder',
        iconAccent: folderAccentIcon(folder.iconName),
        label: folder.title,
        title: folder.title,
        type: 'folder' as const
      })
    ),
    {
      active: source.chatListMode === 'archive',
      badge: folderBadge(
        source.chatNavigation.archiveUnreadCount,
        source.chatNavigation.archiveMutedUnreadCount
      ),
      badgeTone: folderBadgeTone(
        source.chatNavigation.archiveUnreadCount,
        source.chatNavigation.archiveMutedUnreadCount
      ),
      id: 'archive',
      icon: 'archive',
      iconAccent: null,
      label: 'Archive',
      title: 'Archive',
      type: 'archive'
    }
  ];
}

function chatListItemView(
  chat: DashboardChat,
  selectedChatId: string | null,
  source: ChatSidebarViewSource
): ChatListItemView {
  const lastMessage = chatLastMessageView(chat);
  return {
    active: chat.id === selectedChatId,
    avatarUrl: providerFileUrl(chat.avatar.small?.url ?? chat.avatar.big?.url ?? null),
    icon: chatIcon(chat),
    id: chat.id,
    initials: chatInitials(chat.title),
    isPinned: chatIsPinned(chat, source),
    isPremium: chat.isPremium && chat.type === 'private',
    lastMessage,
    notificationsEnabled: chat.notificationsEnabled,
    notificationsPlaceholder: chat.notificationsPlaceholder,
    title: chat.title,
    unreadBadge: formatOptionalBadge(chat.unreadCount)
  };
}

function chatInitials(title: string): string {
  const parts = title
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((part) => part.length > 0);
  const initials = parts
    .slice(0, 2)
    .map((part) => firstGrapheme(part))
    .join('');
  return initials.length === 0 ? '?' : initials.toLocaleUpperCase();
}

function firstGrapheme(value: string): string {
  for (const segment of graphemeSegmenter.segment(value)) {
    return segment.segment;
  }
  return '';
}

function providerFileUrl(url: string | null): string | null {
  if (!url?.startsWith('/')) {
    return null;
  }
  return `/dashboard/module-files/telegram/${url.slice(1).split('/').map(encodeURIComponent).join('/')}`;
}

function chatIcon(chat: DashboardChat): ChatIconKind | null {
  if (chat.isBot) {
    return 'bot';
  }
  if (chat.type === 'channel' || chat.type === 'group' || chat.type === 'secret') {
    return chat.type;
  }
  return null;
}

function chatLastMessageView(chat: DashboardChat): ChatListItemView['lastMessage'] {
  if (chat.lastMessage === null) {
    return {
      author: '',
      authorPlaceholder: false,
      dateLabel: 'No date',
      datePlaceholder: true,
      isForwarded: false,
      readState: null,
      showAuthor: false,
      text: 'No last message',
      textPlaceholder: true
    };
  }

  return {
    author: chat.lastMessage.isOutgoing ? 'You' : (chat.lastMessage.authorName ?? 'Unknown author'),
    authorPlaceholder:
      !chat.lastMessage.isOutgoing &&
      (chat.lastMessage.authorPlaceholder || chat.lastMessage.authorName === null),
    dateLabel: formatMessageDate(chat.lastMessage.date),
    datePlaceholder: chat.lastMessage.datePlaceholder,
    isForwarded: chat.lastMessage.isForwarded,
    readState: chat.lastMessage.isOutgoing
      ? chat.lastMessage.readPlaceholder
        ? 'placeholder'
        : chat.lastMessage.isRead === true
          ? 'read'
          : 'sent'
      : null,
    showAuthor: chat.type !== 'private' && chat.type !== 'secret' && !chat.lastMessage.isForwarded,
    text: chat.lastMessage.text.length === 0 ? 'Message unavailable' : chat.lastMessage.text,
    textPlaceholder: chat.lastMessage.textPlaceholder || chat.lastMessage.text.length === 0
  };
}

function chatIsPinned(chat: DashboardChat, source: ChatSidebarViewSource): boolean {
  return chat.placements.some((placement) => placementMatchesCurrentList(placement, source));
}

function placementMatchesCurrentList(
  placement: ChatPlacement,
  source: ChatSidebarViewSource
): boolean {
  if (!placement.isPinned) {
    return false;
  }
  if (source.chatListMode === 'main') {
    return placement.kind === 'main';
  }
  if (source.chatListMode === 'archive') {
    return placement.kind === 'archive';
  }
  return (
    placement.kind === 'folder' &&
    source.chatFolderId !== null &&
    placement.folderId === source.chatFolderId
  );
}

function formatMessageDate(value: string | null): string {
  if (value === null) {
    return 'No date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No date';
  }
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(date);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatOptionalBadge(value: number | undefined): string {
  return value === undefined || value <= 0 ? '' : formatInteger(value);
}

function folderBadge(unreadCount: number, mutedUnreadCount: number): string {
  return formatOptionalBadge(unreadCount > 0 ? unreadCount : mutedUnreadCount);
}

function folderBadgeTone(unreadCount: number, mutedUnreadCount: number): 'muted' | 'notify' {
  return unreadCount > 0 || mutedUnreadCount <= 0 ? 'notify' : 'muted';
}

function folderAccentIcon(iconName: string | null): ChatFolderAccentIcon | null {
  if (iconName === null) {
    return null;
  }
  const normalized = iconName.trim().toLocaleLowerCase();
  const namedIcons: Record<string, ChatFolderAccentIcon> = {
    book: 'book',
    bot: 'bot',
    crown: 'crown',
    favorite: 'favorite',
    game: 'game',
    home: 'home',
    love: 'love',
    private: 'private',
    school: 'school',
    sport: 'sport',
    study: 'school',
    trade: 'trade',
    travel: 'travel',
    unread: 'unread',
    work: 'work'
  };
  return namedIcons[normalized] ?? null;
}
