import type {
  ChatListMode,
  ChatNavigation,
  ChatPlacement,
  ControlPlaneChat,
  HistoryBoundary,
  HistoryChatTypeCount,
  HistoryInterval,
  HistoryJob,
  HistoryOverview,
  HistoryRange,
  HistoryTarget,
  SelectedHistoryChat,
  SelectedHistoryState
} from '../stores/controlPlaneTypes.js';

export type ControlPlaneRpcClient = {
  rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
};

export type ControlPlaneChatListRequest = {
  folderId: number | null;
  focusChatId?: string | null;
  limit?: number;
  listMode: ChatListMode;
  query: string;
};

export type ControlPlaneChatListResult = {
  chats: ControlPlaneChat[];
  navigation: ChatNavigation;
  types: HistoryChatTypeCount[];
};

type ControlPlaneChatListRpcResult = {
  chats?: unknown;
  navigation?: unknown;
  types?: unknown;
};

export type ControlPlaneApi = {
  deleteTarget: (targetId: string) => Promise<unknown>;
  getChatHistoryState: (chatId: string) => Promise<SelectedHistoryState>;
  getOverview: () => Promise<HistoryOverview>;
  listChats: (request: ControlPlaneChatListRequest) => Promise<ControlPlaneChatListResult>;
  upsertCustomTarget: (chatId: string, start: string, end: string) => Promise<unknown>;
  upsertPresetTarget: (chatId: string, preset: string) => Promise<unknown>;
};

const DEFAULT_CHAT_LIMIT = 500;

export function createControlPlaneApi(client: ControlPlaneRpcClient): ControlPlaneApi {
  return {
    deleteTarget(targetId) {
      return client.rpc('history.deleteTarget', { targetId });
    },
    getChatHistoryState(chatId) {
      return client
        .rpc('history.getChatHistoryState', { chatId })
        .then(normalizeSelectedHistoryState);
    },
    getOverview() {
      return client.rpc('controlPlane.getOverview').then(normalizeHistoryOverview);
    },
    async listChats(request) {
      const result = await client.rpc<ControlPlaneChatListRpcResult>(
        'controlPlane.listChats',
        controlPlaneChatListParams(request)
      );
      return {
        chats: asArray(result.chats).map(normalizeControlPlaneChat),
        navigation: normalizeChatNavigationResult(result.navigation),
        types: asArray(result.types).map(normalizeHistoryChatTypeCount)
      };
    },
    upsertCustomTarget(chatId, start, end) {
      return client.rpc('history.upsertTarget', { chatId, end, start });
    },
    upsertPresetTarget(chatId, preset) {
      return client.rpc('history.upsertTarget', { chatId, preset });
    }
  };
}

function controlPlaneChatListParams(request: ControlPlaneChatListRequest): Record<string, unknown> {
  const query = request.query.trim();
  const focusChatId = request.focusChatId?.trim();
  const params: Record<string, unknown> = {
    limit: request.limit ?? DEFAULT_CHAT_LIMIT
  };

  if (focusChatId !== undefined && focusChatId.length > 0) {
    params.focusChatId = focusChatId;
  }

  if (query.length === 0) {
    params.list = request.listMode;
    if (request.listMode === 'folder') {
      params.folderId = request.folderId;
    }
  } else {
    params.query = query;
  }

  return params;
}

function normalizeChatNavigationResult(navigation: unknown): ChatNavigation {
  const input = asRecord(navigation);
  return {
    archiveCount: asNonNegativeInteger(input?.archiveCount),
    folders: asArray(input?.folders).map(normalizeChatFolder),
    mainCount: asNonNegativeInteger(input?.mainCount)
  };
}

function normalizeHistoryOverview(value: unknown): HistoryOverview {
  const input = asRecord(value);
  const activeJob = asRecord(input?.activeJob);

  return {
    activeJob:
      activeJob === undefined
        ? null
        : {
            chatId: asString(activeJob.chatId) ?? '',
            endAt: asString(activeJob.endAt) ?? '',
            startAt: asString(activeJob.startAt) ?? '',
            status: asString(activeJob.status) ?? ''
          },
    chats: asNonNegativeInteger(input?.chats),
    coverageIntervals: asNonNegativeInteger(input?.coverageIntervals),
    pendingJobs: asNonNegativeInteger(input?.pendingJobs),
    runningJobs: asNonNegativeInteger(input?.runningJobs),
    targets: asNonNegativeInteger(input?.targets),
    templates: asNonNegativeInteger(input?.templates)
  };
}

function normalizeControlPlaneChat(value: unknown): ControlPlaneChat {
  const input = asRecord(value);
  return {
    coverageIntervals: asNonNegativeInteger(input?.coverageIntervals),
    id: asString(input?.id) ?? '',
    isBot: input?.isBot === true,
    pendingJobs: asNonNegativeInteger(input?.pendingJobs),
    placements: asArray(input?.placements).map(normalizeChatPlacement).filter(isDefined),
    runningJobs: asNonNegativeInteger(input?.runningJobs),
    targets: asNonNegativeInteger(input?.targets),
    title: asString(input?.title) ?? '',
    type: asString(input?.type) ?? '',
    updatedAt: asString(input?.updatedAt) ?? ''
  };
}

function normalizeChatPlacement(value: unknown): ChatPlacement | undefined {
  const input = asRecord(value);
  const kind = asString(input?.kind);
  const order = asString(input?.order) ?? '0';
  if (kind === 'main' || kind === 'archive') {
    return { kind, order };
  }
  if (kind === 'folder') {
    const folderId = input?.folderId;
    if (typeof folderId === 'number' && Number.isSafeInteger(folderId) && folderId >= 0) {
      return { folderId, kind, order };
    }
  }
  return undefined;
}

function normalizeChatFolder(value: unknown): ChatNavigation['folders'][number] {
  const input = asRecord(value);
  return {
    count: asNonNegativeInteger(input?.count),
    iconName: asString(input?.iconName) ?? null,
    id: asNonNegativeInteger(input?.id),
    position: asNonNegativeInteger(input?.position),
    title: asString(input?.title) ?? ''
  };
}

function normalizeHistoryChatTypeCount(value: unknown): HistoryChatTypeCount {
  const input = asRecord(value);
  return {
    count: asNonNegativeInteger(input?.count),
    type: asString(input?.type) ?? ''
  };
}

function normalizeSelectedHistoryState(value: unknown): SelectedHistoryState {
  const input = asRecord(value);
  const chat = normalizeSelectedHistoryChat(input?.chat);

  return {
    chat,
    coverage: asArray(input?.coverage).map(normalizeHistoryInterval),
    desired: asArray(input?.desired).map(normalizeHistoryInterval),
    jobs: asArray(input?.jobs).map(normalizeHistoryJob),
    missing: asArray(input?.missing).map(normalizeHistoryInterval),
    targets: asArray(input?.targets).map(normalizeHistoryTarget)
  };
}

function normalizeSelectedHistoryChat(value: unknown): SelectedHistoryChat | null {
  const input = asRecord(value);
  if (input === undefined) {
    return null;
  }

  return {
    historyBeginningReached: input.historyBeginningReached === true,
    historyStartAt: asString(input.historyStartAt) ?? null,
    id: asString(input.id) ?? '',
    isBot: input.isBot === true,
    messageCount: asNonNegativeInteger(input.messageCount),
    title: asString(input.title) ?? '',
    type: asString(input.type) ?? '',
    updatedAt: asString(input.updatedAt) ?? ''
  };
}

function normalizeHistoryInterval(value: unknown): HistoryInterval {
  const input = asRecord(value);
  return removeUndefinedProperties({
    endAt: asString(input?.endAt) ?? '',
    messageCount:
      input?.messageCount === undefined ? undefined : asNonNegativeInteger(input.messageCount),
    startAt: asString(input?.startAt) ?? ''
  }) as HistoryInterval;
}

function normalizeHistoryJob(value: unknown): HistoryJob {
  const input = asRecord(value);
  const cursor = asRecord(input?.cursor);
  return removeUndefinedProperties({
    ...(cursor === undefined ? {} : { cursor }),
    endAt: asString(input?.endAt) ?? '',
    id: asString(input?.id) ?? '',
    startAt: asString(input?.startAt) ?? '',
    status: asString(input?.status) ?? '',
    telegramChatId: asString(input?.telegramChatId),
    updatedAt: asString(input?.updatedAt) ?? ''
  }) as HistoryJob;
}

function normalizeHistoryTarget(value: unknown): HistoryTarget {
  const input = asRecord(value);
  const projected = asRecord(input?.projected);
  return removeUndefinedProperties({
    chatId: asString(input?.chatId) ?? '',
    id: asString(input?.id) ?? '',
    projected: projected === undefined ? undefined : normalizeHistoryInterval(projected),
    range: normalizeHistoryRange(input?.range),
    templateId: input?.templateId === null ? null : asString(input?.templateId)
  }) as HistoryTarget;
}

function normalizeHistoryRange(value: unknown): HistoryRange {
  const input = asRecord(value);
  return {
    end: normalizeHistoryBoundary(input?.end),
    start: normalizeHistoryBoundary(input?.start)
  };
}

function normalizeHistoryBoundary(value: unknown): HistoryBoundary {
  const input = asRecord(value);
  if (input?.kind === 'absolute') {
    return {
      at: asString(input.at) ?? '',
      kind: 'absolute'
    };
  }
  return {
    expression: asString(input?.expression) ?? '',
    kind: 'expression'
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) !== undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function removeUndefinedProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}
