import type {
  ChatListMode,
  ChatNavigation,
  ControlPlaneChat,
  HistoryOverview,
  SelectedHistoryState
} from '../stores/controlPlaneTypes.js';

export type GatewayRpcClient = {
  rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
};

export type HistoryChatListRequest = {
  folderId: number | null;
  limit?: number;
  listMode: ChatListMode;
  query: string;
};

export type HistoryChatListResult = {
  chats: ControlPlaneChat[];
  navigation: ChatNavigation;
  types?: unknown[];
};

type HistoryChatListRpcResult = {
  chats: ControlPlaneChat[];
  navigation?: ChatNavigation;
  types?: unknown[];
};

export type HistoryApi = {
  deleteTarget: (targetId: string) => Promise<unknown>;
  getChatHistoryState: (chatId: string) => Promise<SelectedHistoryState>;
  getOverview: () => Promise<HistoryOverview>;
  listChats: (request: HistoryChatListRequest) => Promise<HistoryChatListResult>;
  upsertCustomTarget: (chatId: string, start: string, end: string) => Promise<unknown>;
  upsertPresetTarget: (chatId: string, preset: string) => Promise<unknown>;
};

const DEFAULT_CHAT_LIMIT = 500;

export function createHistoryApi(client: GatewayRpcClient): HistoryApi {
  return {
    deleteTarget(targetId) {
      return client.rpc('history.deleteTarget', { targetId });
    },
    getChatHistoryState(chatId) {
      return client.rpc('history.getChatHistoryState', { chatId });
    },
    getOverview() {
      return client.rpc('history.getOverview');
    },
    async listChats(request) {
      const result = await client.rpc<HistoryChatListRpcResult>(
        'history.listChats',
        historyChatListParams(request)
      );
      return {
        ...result,
        navigation: normalizeChatNavigationResult(result.navigation)
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

function historyChatListParams(request: HistoryChatListRequest): Record<string, unknown> {
  const query = request.query.trim();
  const params: Record<string, unknown> = {
    limit: request.limit ?? DEFAULT_CHAT_LIMIT,
    query
  };

  if (query.length === 0) {
    params.list = request.listMode;
    if (request.listMode === 'folder') {
      params.folderId = request.folderId;
    }
  }

  return params;
}

function normalizeChatNavigationResult(navigation: ChatNavigation | undefined): ChatNavigation {
  return {
    archiveCount: navigation?.archiveCount ?? 0,
    folders: navigation?.folders?.slice() ?? [],
    mainCount: navigation?.mainCount ?? 0
  };
}
