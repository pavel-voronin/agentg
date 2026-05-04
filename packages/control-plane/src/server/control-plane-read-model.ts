import type { createHistoryRpcClient } from '@agentg/history-sync/rpc';
import type {
  TelegramChatDirectoryEntry,
  TelegramChatFolder,
  TelegramChatTypeCount
} from '@agentg/telegram/rpc';

import type { TelegramDirectoryClient } from './telegram-client.js';

type HistoryRpcClient = ReturnType<typeof createHistoryRpcClient>;

type ChatListKind =
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

type TelegramChatSortKey = {
  id: string;
  lastMessageDate: number;
  listRank: number;
  order: bigint;
  title: string;
};

type ChatStats = {
  chatId: string;
  coverageIntervals: number;
  coverageNewestAt: string | null;
  coverageOldestAt: string | null;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
};

type ControlPlaneChatListResult = {
  chats: {
    _model: 'telegram.chat';
    coverageIntervals: number;
    coverageNewestAt: string | null;
    coverageOldestAt: string | null;
    id: string;
    isBot: boolean;
    pendingJobs: number;
    runningJobs: number;
    targets: number;
    title: string;
    type: string;
    updatedAt: string;
  }[];
  navigation: {
    archiveCount: number;
    folders: {
      count: number;
      iconName: string | null;
      id: number;
      position: number;
      title: string;
    }[];
    mainCount: number;
  };
  types: TelegramChatTypeCount[];
};

export type ControlPlaneReadModelRuntime = {
  historyClient: HistoryRpcClient;
  telegramClient: TelegramDirectoryClient;
};

export async function callControlPlaneReadMethod(
  runtime: ControlPlaneReadModelRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'controlPlane.getOverview') {
    return getControlPlaneOverview(runtime);
  }

  if (method === 'controlPlane.listChats') {
    return listControlPlaneChats(runtime, params);
  }

  return undefined;
}

async function getControlPlaneOverview(runtime: ControlPlaneReadModelRuntime): Promise<unknown> {
  const [historyOverview, directory] = await Promise.all([
    runtime.historyClient.getOverview(),
    runtime.telegramClient.listChatDirectory({})
  ]);
  const overview = asRecord(historyOverview);

  return {
    activeJob: overview?.activeJob ?? null,
    chats: directory.chats.length,
    coverageIntervals: asNonNegativeInteger(overview?.coverageIntervals),
    pendingJobs: asNonNegativeInteger(overview?.pendingJobs),
    runningJobs: asNonNegativeInteger(overview?.runningJobs),
    targets: asNonNegativeInteger(overview?.targets),
    templates: asNonNegativeInteger(overview?.templates)
  };
}

async function listControlPlaneChats(
  runtime: ControlPlaneReadModelRuntime,
  params: unknown
): Promise<ControlPlaneChatListResult> {
  const input = asRecord(params);
  const query = asString(input?.query)?.trim();
  const type = asString(input?.type)?.trim();
  const limit = parseLimit(input?.limit, 100, 500);
  const listFilter =
    query === undefined || query.length === 0 ? chatListFilterFromInput(input) : undefined;
  const directory = await runtime.telegramClient.listChatDirectory({
    ...(query === undefined || query.length === 0 ? {} : { query }),
    ...(type === undefined || type.length === 0 ? {} : { type })
  });
  const chats = directory.chats
    .filter((chat) => (listFilter === undefined ? true : chatMatchesListFilter(chat, listFilter)))
    .sort((left, right) => compareTelegramChatsByTdlibOrder(left, right, listFilter))
    .slice(0, limit);
  const statsByChat = await loadStatsByChat(
    runtime.historyClient,
    chats.map((chat) => chat.id)
  );

  return {
    chats: chats.map((chat) => {
      const stats = statsByChat.get(chat.id) ?? emptyChatStats(chat.id);

      return {
        _model: 'telegram.chat',
        coverageIntervals: stats.coverageIntervals,
        coverageNewestAt: stats.coverageNewestAt,
        coverageOldestAt: stats.coverageOldestAt,
        id: chat.id,
        isBot: chat.isBot,
        pendingJobs: stats.pendingJobs,
        runningJobs: stats.runningJobs,
        targets: stats.targets,
        title: chat.title,
        type: chat.type,
        updatedAt: chat.updatedAt
      };
    }),
    navigation: controlPlaneChatNavigation(directory.navigationChats, directory.folders),
    types: directory.types
  };
}

async function loadStatsByChat(
  historyClient: HistoryRpcClient,
  chatIds: string[]
): Promise<Map<string, ChatStats>> {
  if (chatIds.length === 0) {
    return new Map();
  }

  const response = asRecord(await historyClient.getChatStats({ chatIds }));
  const stats = asArray(response?.stats).map(normalizeChatStats);
  return new Map(stats.map((stat) => [stat.chatId, stat]));
}

function normalizeChatStats(value: Record<string, unknown>): ChatStats {
  const chatId = asString(value.chatId) ?? '';
  return {
    chatId,
    coverageIntervals: asNonNegativeInteger(value.coverageIntervals),
    coverageNewestAt: asNullableString(value.coverageNewestAt),
    coverageOldestAt: asNullableString(value.coverageOldestAt),
    pendingJobs: asNonNegativeInteger(value.pendingJobs),
    runningJobs: asNonNegativeInteger(value.runningJobs),
    targets: asNonNegativeInteger(value.targets)
  };
}

function emptyChatStats(chatId: string): ChatStats {
  return {
    chatId,
    coverageIntervals: 0,
    coverageNewestAt: null,
    coverageOldestAt: null,
    pendingJobs: 0,
    runningJobs: 0,
    targets: 0
  };
}

function chatListFilterFromInput(input: Record<string, unknown> | undefined): ChatListKind {
  const list = asString(input?.list);
  if (list === 'archive') {
    return { kind: 'archive' };
  }

  if (list === 'folder') {
    return {
      folderId: requireSafeInteger(
        input?.folderId,
        'controlPlane.listChats folder list requires folderId'
      ),
      kind: 'folder'
    };
  }

  return { kind: 'main' };
}

function controlPlaneChatNavigation(
  chats: TelegramChatDirectoryEntry[],
  folderRows: TelegramChatFolder[]
): ControlPlaneChatListResult['navigation'] {
  const folderCounts = new Map<number, number>();
  let archiveCount = 0;
  let mainCount = 0;

  for (const chat of chats) {
    if (chatMatchesListFilter(chat, { kind: 'main' })) {
      mainCount += 1;
    }
    if (chatMatchesListFilter(chat, { kind: 'archive' })) {
      archiveCount += 1;
    }
    for (const folderId of chatFolderIds(chat)) {
      folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
    }
  }

  const knownFolderIds = new Set(folderRows.map((folder) => folder.id));
  const unknownFolderIds = [...folderCounts.keys()]
    .filter((id) => !knownFolderIds.has(id))
    .sort((left, right) => left - right);

  return {
    archiveCount,
    folders: [
      ...folderRows.map((folder) => ({
        count: folderCounts.get(folder.id) ?? 0,
        iconName: folder.iconName,
        id: folder.id,
        position: folder.position,
        title: folder.title
      })),
      ...unknownFolderIds.map((id) => ({
        count: folderCounts.get(id) ?? 0,
        iconName: null,
        id,
        position: id,
        title: `Folder ${String(id)}`
      }))
    ],
    mainCount
  };
}

function chatMatchesListFilter(chat: TelegramChatDirectoryEntry, filter: ChatListKind): boolean {
  return chat.placements.some((placement) => chatPlacementMatchesFilter(placement, filter));
}

function chatFolderIds(chat: TelegramChatDirectoryEntry): number[] {
  return chat.placements
    .filter((placement) => placement.kind === 'folder')
    .map((placement) => placement.folderId);
}

function compareTelegramChatsByTdlibOrder(
  left: TelegramChatDirectoryEntry,
  right: TelegramChatDirectoryEntry,
  filter?: ChatListKind
): number {
  const leftKey = telegramChatSortKey(left, filter);
  const rightKey = telegramChatSortKey(right, filter);

  if (leftKey.listRank !== rightKey.listRank) {
    return leftKey.listRank - rightKey.listRank;
  }

  const orderComparison = compareBigIntDescending(leftKey.order, rightKey.order);
  if (orderComparison !== 0) {
    return orderComparison;
  }

  if (leftKey.lastMessageDate !== rightKey.lastMessageDate) {
    return rightKey.lastMessageDate - leftKey.lastMessageDate;
  }

  return leftKey.title.localeCompare(rightKey.title) || leftKey.id.localeCompare(rightKey.id);
}

function telegramChatSortKey(
  chat: TelegramChatDirectoryEntry,
  filter?: ChatListKind
): TelegramChatSortKey {
  const position = preferredChatPlacement(chat, filter);
  return {
    id: chat.id,
    lastMessageDate: chat.lastMessageDate,
    listRank: position?.listRank ?? 3,
    order: position?.order ?? 0n,
    title: chat.title
  };
}

function preferredChatPlacement(
  chat: TelegramChatDirectoryEntry,
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

function chatPlacementMatchesFilter(
  placement: TelegramChatDirectoryEntry['placements'][number],
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

function chatPlacementRank(placement: TelegramChatDirectoryEntry['placements'][number]): number {
  if (placement.kind === 'main') {
    return 0;
  }

  if (placement.kind === 'archive') {
    return 1;
  }

  return 2;
}

function compareBigIntDescending(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
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

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
      )
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function requireSafeInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(message);
  }

  return value;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
