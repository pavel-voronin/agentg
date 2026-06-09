import {
  chatFolderIds,
  chatMatchesListFilter,
  chatPlacementMatchesFilter,
  chatPlacementRank,
  type ChatListKind
} from './chatListFiltering.js';
import type {
  ChatListMode,
  ChatNavigation,
  ChatPlacement,
  DashboardChat,
  TelegramDirectoryChat,
  TelegramDirectoryFolder
} from './views.js';

const DEFAULT_CHAT_LIMIT = 500;

export type ChatHeaderView = {
  avatarUrl: string | null;
  initials: string;
  subtitle: string;
  title: string;
};

export function buildChatHeaderView(
  chat: TelegramDirectoryChat | null,
  avatarUrl: string | null
): ChatHeaderView | null {
  return chat === null
    ? null
    : {
        avatarUrl,
        initials: chatInitials(chat.title),
        subtitle: chatHeaderSubtitle(chat),
        title: chat.title
      };
}

export function buildChatNavigation(
  navigationChats: readonly TelegramDirectoryChat[],
  folderRows: readonly TelegramDirectoryFolder[]
): ChatNavigation {
  const folderCounts = new Map<number, number>();
  const folderMutedUnreadCounts = new Map<number, number>();
  const folderUnreadCounts = new Map<number, number>();
  let archiveCount = 0;
  let archiveMutedUnreadCount = 0;
  let archiveUnreadCount = 0;
  let mainCount = 0;
  let mainMutedUnreadCount = 0;
  let mainUnreadCount = 0;

  for (const chat of navigationChats) {
    if (chatMatchesListFilter(chat, { kind: 'main' })) {
      mainCount += 1;
      if (chatHasNotifyingUnreadMessages(chat)) {
        mainUnreadCount += 1;
      } else if (chatHasMutedUnreadMessages(chat)) {
        mainMutedUnreadCount += 1;
      }
    }
    if (chatMatchesListFilter(chat, { kind: 'archive' })) {
      archiveCount += 1;
      if (chatHasNotifyingUnreadMessages(chat)) {
        archiveUnreadCount += 1;
      } else if (chatHasMutedUnreadMessages(chat)) {
        archiveMutedUnreadCount += 1;
      }
    }
    for (const folderId of chatFolderIds(chat)) {
      folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
      if (chatHasNotifyingUnreadMessages(chat)) {
        folderUnreadCounts.set(folderId, (folderUnreadCounts.get(folderId) ?? 0) + 1);
      } else if (chatHasMutedUnreadMessages(chat)) {
        folderMutedUnreadCounts.set(folderId, (folderMutedUnreadCounts.get(folderId) ?? 0) + 1);
      }
    }
  }

  const knownFolderIds = new Set(folderRows.map((folder) => folder.folderId));
  const unknownFolderIds = [...folderCounts.keys()]
    .filter((id) => !knownFolderIds.has(id))
    .sort((left, right) => left - right);

  return {
    archiveCount,
    archiveMutedUnreadCount,
    archiveUnreadCount,
    folders: [
      ...folderRows.map((folder) => ({
        count: folderCounts.get(folder.folderId) ?? 0,
        iconName: folder.iconName,
        id: folder.folderId,
        mutedUnreadCount: folderMutedUnreadCounts.get(folder.folderId) ?? 0,
        position: folder.position,
        title: folder.title,
        unreadCount: folderUnreadCounts.get(folder.folderId) ?? 0
      })),
      ...unknownFolderIds.map((id) => ({
        count: folderCounts.get(id) ?? 0,
        iconName: null,
        id,
        mutedUnreadCount: folderMutedUnreadCounts.get(id) ?? 0,
        position: id,
        title: `Folder ${String(id)}`,
        unreadCount: folderUnreadCounts.get(id) ?? 0
      }))
    ],
    mainCount,
    mainMutedUnreadCount,
    mainUnreadCount
  };
}

export function chatListFilter(mode: ChatListMode, folderId: number | null): ChatListKind {
  if (mode === 'archive') {
    return { kind: 'archive' };
  }
  if (mode === 'folder' && folderId !== null) {
    return { folderId, kind: 'folder' };
  }
  return { kind: 'main' };
}

export function dashboardChats(visibleChats: readonly TelegramDirectoryChat[]): DashboardChat[] {
  return visibleChats.map((chat) => ({
    ...chat,
    _model: 'telegram.chat'
  }));
}

export function normalizedChatQuery(chatFilter: string): string {
  return chatFilter.trim().toLocaleLowerCase();
}

export function preferredChatListSelection(chat: TelegramDirectoryChat): {
  folderId: number | null;
  mode: ChatListMode;
} {
  const placement = [...chat.placements].sort(compareChatPlacements)[0];
  if (placement === undefined) {
    throw new Error(`Chat ${chat.id} has no Telegram list placement`);
  }
  if (placement.kind === 'folder') {
    return { folderId: placement.folderId, mode: 'folder' };
  }
  return { folderId: null, mode: placement.kind };
}

export function providerFileUrl(url: string | null): string | null {
  if (!url?.startsWith('/')) {
    return null;
  }
  return `/dashboard/module-files/telegram/${url
    .slice(1)
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export function visibleDirectoryChats(input: {
  chatFilter: string;
  chatListMode: ChatListMode;
  chats: readonly TelegramDirectoryChat[];
  folderId: number | null;
  selectedChatId: string | null;
}): TelegramDirectoryChat[] {
  const query = normalizedChatQuery(input.chatFilter);
  const listFilter =
    query.length === 0 ? chatListFilter(input.chatListMode, input.folderId) : undefined;
  const matchingChats = input.chats
    .filter((chat) => (query.length === 0 ? true : chatMatchesSearch(chat, query)))
    .filter((chat) => (listFilter === undefined ? true : chatMatchesListFilter(chat, listFilter)))
    .sort((left, right) => compareChatsByOrder(left, right, listFilter));

  return limitChats(matchingChats, DEFAULT_CHAT_LIMIT, input.selectedChatId ?? undefined);
}

function chatHeaderSubtitle(chat: TelegramDirectoryChat): string {
  if (chat.isBot) {
    return 'bot';
  }
  if (chat.type === 'private') {
    return 'private chat';
  }
  if (chat.type === 'group') {
    return 'group';
  }
  if (chat.type === 'channel') {
    return 'channel';
  }
  if (chat.type === 'secret') {
    return 'secret chat';
  }
  return chat.type;
}

function chatInitials(title: string): string {
  const trimmed = title.trim();
  return trimmed.length === 0 ? '?' : trimmed.slice(0, 1).toLocaleUpperCase();
}

function chatMatchesSearch(chat: TelegramDirectoryChat, normalizedQuery: string): boolean {
  return (
    chat.title.toLocaleLowerCase().includes(normalizedQuery) ||
    chat.id.toLocaleLowerCase().includes(normalizedQuery)
  );
}

function chatHasMutedUnreadMessages(chat: TelegramDirectoryChat): boolean {
  return (chat.unreadCount > 0 || chat.isUnread) && chat.notificationsEnabled === false;
}

function chatHasNotifyingUnreadMessages(chat: TelegramDirectoryChat): boolean {
  return (chat.unreadCount > 0 || chat.isUnread) && chat.notificationsEnabled === true;
}

function compareBigIntDescending(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }
  return left > right ? -1 : 1;
}

function compareChatPlacements(left: ChatPlacement, right: ChatPlacement): number {
  const leftRank = chatPlacementRank(left);
  const rightRank = chatPlacementRank(right);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const orderComparison = compareBigIntDescending(
    parsePositiveBigInt(left.order) ?? 0n,
    parsePositiveBigInt(right.order) ?? 0n
  );
  if (orderComparison !== 0) {
    return orderComparison;
  }
  const leftFolderId = left.kind === 'folder' ? left.folderId : 0;
  const rightFolderId = right.kind === 'folder' ? right.folderId : 0;
  return leftFolderId - rightFolderId;
}

function compareChatsByOrder(
  left: TelegramDirectoryChat,
  right: TelegramDirectoryChat,
  filter?: ChatListKind
): number {
  const leftKey = chatSortKey(left, filter);
  const rightKey = chatSortKey(right, filter);

  if (leftKey.listRank !== rightKey.listRank) {
    return leftKey.listRank - rightKey.listRank;
  }

  const orderComparison = compareBigIntDescending(leftKey.order, rightKey.order);
  if (orderComparison !== 0) {
    return orderComparison;
  }

  if (leftKey.lastMessageAt !== rightKey.lastMessageAt) {
    return rightKey.lastMessageAt - leftKey.lastMessageAt;
  }

  return leftKey.title.localeCompare(rightKey.title) || leftKey.id.localeCompare(rightKey.id);
}

function chatSortKey(chat: TelegramDirectoryChat, filter?: ChatListKind) {
  const position = preferredChatPlacement(chat, filter);
  return {
    id: chat.id,
    lastMessageAt: isoTimeMs(chat.lastMessageDate),
    listRank: position?.listRank ?? 3,
    order: position?.order ?? 0n,
    title: chat.title
  };
}

function isoTimeMs(value: string | null): number {
  if (value === null) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function limitChats(
  input: readonly TelegramDirectoryChat[],
  limit: number,
  focusChatId: string | undefined
): TelegramDirectoryChat[] {
  const limited = input.slice(0, limit);
  if (focusChatId === undefined || limited.some((chat) => chat.id === focusChatId)) {
    return limited;
  }
  const focusedChat = input.find((chat) => chat.id === focusChatId);
  return focusedChat === undefined ? limited : [...limited, focusedChat];
}

function parsePositiveBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  }
  return undefined;
}

function preferredChatPlacement(
  chat: TelegramDirectoryChat,
  filter?: ChatListKind
): { listRank: number; order: bigint } | undefined {
  const placements = chat.placements
    .map((placement) => {
      const order = parsePositiveBigInt(placement.order);
      if (order === undefined) {
        return undefined;
      }
      if (filter !== undefined && !chatPlacementMatchesFilter(placement, filter)) {
        return undefined;
      }
      return {
        listRank: chatPlacementRank(placement),
        order
      };
    })
    .filter(isDefined);

  return placements.sort((left, right) => {
    if (left.listRank !== right.listRank) {
      return left.listRank - right.listRank;
    }
    return compareBigIntDescending(left.order, right.order);
  })[0];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
