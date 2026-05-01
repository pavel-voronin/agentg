import {
  HistoryChatListKind,
  HistoryServiceClient,
  type HistoryBoundary,
  type HistoryChatHistoryStateResponse,
  type HistoryInterval,
  type HistoryJob,
  type HistoryListChatsResponse,
  type HistoryOverviewResponse,
  type HistoryRange,
  type HistoryServiceClient as GeneratedHistoryServiceClient,
  type HistoryStoredTarget,
  type HistoryTarget,
  type HistoryTargetMutationResponse
} from '../../../generated/agentg/history/v1/history.js';
import { grpcTargetFromInternalRpcUrl, type InternalRpcClientConfig } from '../../../rpc/config.js';
import {
  createInsecureInternalRpcCredentials,
  createInternalRpcCallOptions,
  createInternalRpcMetadata
} from '../../../rpc/grpc.js';
import type { ServiceError } from '@grpc/grpc-js';

export type HistoryJsonRpcClient = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

export type HistoryJsonRpcClientOptions = {
  timeoutMs?: number;
};

const DEFAULT_HISTORY_REQUEST_TIMEOUT_MS = 15000;

export function createGrpcHistoryJsonRpcClient(
  config: InternalRpcClientConfig,
  options: HistoryJsonRpcClientOptions = {}
): HistoryJsonRpcClient {
  const client = new HistoryServiceClient(
    grpcTargetFromInternalRpcUrl(config.url, 'HISTORY_RPC_URL'),
    createInsecureInternalRpcCredentials()
  );
  const timeoutMs = options.timeoutMs ?? DEFAULT_HISTORY_REQUEST_TIMEOUT_MS;

  return {
    call(method, params) {
      return callHistoryJsonRpcMethod(client, method, params, timeoutMs);
    },
    close() {
      client.close();
    }
  };
}

export async function callHistoryJsonRpcMethod(
  client: GeneratedHistoryServiceClient,
  method: string,
  params: unknown,
  timeoutMs = DEFAULT_HISTORY_REQUEST_TIMEOUT_MS
): Promise<unknown> {
  switch (method) {
    case 'history.getOverview':
      return overviewResult(await unary(client.getOverview.bind(client), {}, timeoutMs));
    case 'history.listChats':
      return listChatsResult(
        await unary(client.listChats.bind(client), listChatsRequest(params), timeoutMs)
      );
    case 'history.getChatHistoryState':
      return chatHistoryStateResult(
        await unary(
          client.getChatHistoryState.bind(client),
          {
            chatId: requireString(
              asRecord(params)?.chatId,
              'history.getChatHistoryState requires chatId'
            )
          },
          timeoutMs
        )
      );
    case 'history.upsertTarget':
      return targetMutationResult(
        await unary(client.upsertTarget.bind(client), upsertTargetRequest(params), timeoutMs)
      );
    case 'history.deleteTarget':
      return targetMutationResult(
        await unary(
          client.deleteTarget.bind(client),
          {
            targetId: requireString(
              asRecord(params)?.targetId,
              'history.deleteTarget requires targetId'
            )
          },
          timeoutMs
        )
      );
    case 'history.requestSync':
      return requestSyncResult(
        await unary(
          client.requestSync.bind(client),
          {
            chatId: asString(asRecord(params)?.chatId) ?? ''
          },
          timeoutMs
        )
      );
    case 'history.listJobs':
      return listJobsResult(
        await unary(client.listJobs.bind(client), listJobsRequest(params), timeoutMs)
      );
    default:
      return undefined;
  }
}

function unary<Request, Response>(
  call: (
    request: Request,
    metadata: ReturnType<typeof createInternalRpcMetadata>,
    options: ReturnType<typeof createInternalRpcCallOptions>,
    callback: (error: ServiceError | null, response: Response) => void
  ) => unknown,
  request: Request,
  timeoutMs: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    call(
      request,
      createInternalRpcMetadata(),
      createInternalRpcCallOptions(timeoutMs),
      (error, response) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(response);
      }
    );
  });
}

function listChatsRequest(params: unknown) {
  const input = asRecord(params);
  const list = asString(input?.list);

  return {
    folderId: list === 'folder' ? asUnsignedInteger(input?.folderId) : 0,
    limit: asUnsignedInteger(input?.limit),
    list: historyChatListKindFromParam(list),
    query: asString(input?.query) ?? '',
    type: asString(input?.type) ?? ''
  };
}

function upsertTargetRequest(params: unknown) {
  const input = asRecord(params);
  return {
    chatId: requireString(input?.chatId, 'history.upsertTarget requires chatId'),
    end: asString(input?.end) ?? '',
    preset: asString(input?.preset) ?? '',
    range: historyRangeToProto(asRecord(input?.range)),
    start: asString(input?.start) ?? '',
    targetId: asString(input?.targetId) ?? ''
  };
}

function listJobsRequest(params: unknown) {
  const input = asRecord(params);
  return {
    limit: asUnsignedInteger(input?.limit),
    status: asString(input?.status) ?? ''
  };
}

function historyChatListKindFromParam(value: string | undefined): HistoryChatListKind {
  if (value === 'archive') {
    return HistoryChatListKind.HISTORY_CHAT_LIST_KIND_ARCHIVE;
  }
  if (value === 'folder') {
    return HistoryChatListKind.HISTORY_CHAT_LIST_KIND_FOLDER;
  }
  if (value === 'main') {
    return HistoryChatListKind.HISTORY_CHAT_LIST_KIND_MAIN;
  }
  return HistoryChatListKind.HISTORY_CHAT_LIST_KIND_UNSPECIFIED;
}

function overviewResult(response: HistoryOverviewResponse): unknown {
  return {
    activeJob:
      response.activeJob === undefined
        ? null
        : {
            chatId: response.activeJob.chatId,
            endAt: response.activeJob.endAt,
            startAt: response.activeJob.startAt,
            status: response.activeJob.status
          },
    chats: response.chats,
    coverageIntervals: response.coverageIntervals,
    pendingJobs: response.pendingJobs,
    runningJobs: response.runningJobs,
    targets: response.targets,
    templates: response.templates
  };
}

function listChatsResult(response: HistoryListChatsResponse): unknown {
  return {
    chats: response.chats.map((chat) => ({
      coverageIntervals: chat.coverageIntervals,
      coverageNewestAt: emptyToNull(chat.coverageNewestAt),
      coverageOldestAt: emptyToNull(chat.coverageOldestAt),
      id: chat.id,
      isBot: chat.isBot,
      pendingJobs: chat.pendingJobs,
      runningJobs: chat.runningJobs,
      targets: chat.targets,
      title: chat.title,
      type: chat.type,
      updatedAt: chat.updatedAt
    })),
    navigation: {
      archiveCount: response.navigation?.archiveCount ?? 0,
      folders:
        response.navigation?.folders.map((folder) => ({
          count: folder.count,
          iconName: emptyToNull(folder.iconName),
          id: folder.id,
          position: folder.position,
          title: folder.title
        })) ?? [],
      mainCount: response.navigation?.mainCount ?? 0
    },
    types: response.types.map((type) => ({
      count: type.count,
      type: type.type
    }))
  };
}

function chatHistoryStateResult(response: HistoryChatHistoryStateResponse): unknown {
  return {
    chat:
      response.chat === undefined
        ? null
        : {
            historyBeginningReached: response.chat.historyBeginningReached,
            historyStartAt: emptyToNull(response.chat.historyStartAt),
            id: response.chat.id,
            isBot: response.chat.isBot,
            messageCount: response.chat.messageCount,
            title: response.chat.title,
            type: response.chat.type,
            updatedAt: response.chat.updatedAt
          },
    coverage: response.coverage.map((interval) => intervalResult(interval, true)),
    desired: response.desired.map((interval) => intervalResult(interval, false)),
    jobs: response.jobs.map((job) => jobResult(job, false)),
    missing: response.missing.map((interval) => intervalResult(interval, false)),
    targets: response.targets.map(targetResult)
  };
}

function targetMutationResult(response: HistoryTargetMutationResponse): unknown {
  return {
    deleted: response.deleted,
    target: storedTargetResult(response.target),
    upserted: response.upserted
  };
}

function requestSyncResult(response: { requested: boolean }): unknown {
  return {
    requested: response.requested
  };
}

function listJobsResult(response: { jobs: HistoryJob[] }): unknown {
  return {
    jobs: response.jobs.map((job) => jobResult(job, true))
  };
}

function targetResult(target: HistoryTarget): unknown {
  return {
    chatId: target.chatId,
    id: target.id,
    projected:
      target.projected === undefined
        ? undefined
        : {
            endAt: target.projected.endAt,
            startAt: target.projected.startAt
          },
    range: rangeResult(target.range),
    templateId: emptyToNull(target.templateId)
  };
}

function storedTargetResult(target: HistoryStoredTarget | undefined): unknown {
  if (target === undefined) {
    return undefined;
  }

  return removeUndefinedProperties({
    chatId: target.chatId,
    id: target.id,
    range: rangeResult(target.range),
    templateId: emptyToUndefined(target.templateId)
  });
}

function intervalResult(interval: HistoryInterval, includeMessageCount: boolean): unknown {
  return removeUndefinedProperties({
    endAt: interval.endAt,
    messageCount: includeMessageCount ? interval.messageCount : undefined,
    startAt: interval.startAt
  });
}

function jobResult(job: HistoryJob, includeTelegramChatId: boolean): unknown {
  return removeUndefinedProperties({
    cursor: parseOptionalJson(job.cursorJson),
    endAt: job.endAt,
    id: job.id,
    startAt: job.startAt,
    status: job.status,
    telegramChatId: includeTelegramChatId ? job.chatId : undefined,
    updatedAt: job.updatedAt
  });
}

function rangeResult(range: HistoryRange | undefined): unknown {
  if (range === undefined) {
    return undefined;
  }

  return {
    end: boundaryResult(range.end),
    start: boundaryResult(range.start)
  };
}

function boundaryResult(boundary: HistoryBoundary | undefined): unknown {
  if (boundary === undefined) {
    return undefined;
  }

  if (boundary.kind === 'absolute') {
    return {
      at: boundary.at,
      kind: 'absolute'
    };
  }

  return {
    expression: boundary.expression,
    kind: 'expression'
  };
}

function historyRangeToProto(range: Record<string, unknown> | undefined): HistoryRange | undefined {
  if (range === undefined) {
    return undefined;
  }

  return {
    end: historyBoundaryToProto(asRecord(range.end)),
    start: historyBoundaryToProto(asRecord(range.start))
  };
}

function historyBoundaryToProto(
  boundary: Record<string, unknown> | undefined
): HistoryBoundary | undefined {
  if (boundary === undefined) {
    return undefined;
  }

  const kind = asString(boundary.kind) ?? '';
  return {
    at: kind === 'absolute' ? (asString(boundary.at) ?? '') : '',
    expression: kind === 'expression' ? (asString(boundary.expression) ?? '') : '',
    kind
  };
}

function requireString(value: unknown, message: string): string {
  const parsed = asString(value);
  if (parsed === undefined) {
    throw new Error(message);
  }
  return parsed;
}

function asUnsignedInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

function emptyToUndefined(value: string): string | undefined {
  return value.length === 0 ? undefined : value;
}

function parseOptionalJson(value: string): unknown {
  if (value.length === 0) {
    return undefined;
  }

  return JSON.parse(value) as unknown;
}

function removeUndefinedProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
