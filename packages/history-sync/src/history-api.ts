import type { AppDatabase } from '@agentg/database/client';
import {
  HistoryActiveJob,
  HistoryBoundary as ProtoHistoryBoundary,
  HistoryChat,
  HistoryChatFolder,
  HistoryChatHistoryStateResponse,
  HistoryChatListKind,
  HistoryChatNavigation,
  HistoryChatTypeCount,
  HistoryInterval as ProtoHistoryInterval,
  HistoryJob,
  HistoryListChatsResponse,
  HistoryListJobsResponse,
  HistoryOverviewResponse,
  HistoryRange as ProtoHistoryRange,
  HistoryRequestSyncResponse,
  HistorySelectedChat,
  HistoryServiceService,
  HistoryStoredTarget,
  HistoryTarget as ProtoHistoryTarget,
  HistoryTargetMutationResponse,
  type HistoryDeleteTargetRequest,
  type HistoryGetChatHistoryStateRequest,
  type HistoryListChatsRequest,
  type HistoryListJobsRequest,
  type HistoryRequestSyncRequest,
  type HistoryServiceServer,
  type HistoryUpsertTargetRequest
} from '@agentg/proto/agentg/history/v1/history';
import { formatInternalRpcBindAddress, type InternalRpcBindConfig } from '@agentg/proto/rpc/config';
import { createInsecureInternalRpcServerCredentials } from '@agentg/proto/rpc/grpc';
import type { EventBus } from '@agentg/shared/events/bus';
import type { JsonObject } from '@agentg/shared/json';
import { Server, status, type sendUnaryData, type ServiceError } from '@grpc/grpc-js';

import { callHistoryMethod, type HistoryRuntime } from './observability.js';
import type { HistoryBoundary, HistoryRange } from './types.js';

export async function startHistoryGrpcServer(options: {
  bind: InternalRpcBindConfig;
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
}): Promise<Server> {
  const server = new Server();
  const address = formatInternalRpcBindAddress(options.bind);

  server.addService(HistoryServiceService, createHistoryService(options));

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(address, createInsecureInternalRpcServerCredentials(), (error) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  console.log(JSON.stringify({ address, event: 'history.rpc.ready' }));
  return server;
}

export function stopHistoryGrpcServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.tryShutdown((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function createHistoryService(runtime: HistoryRuntime): HistoryServiceServer {
  return {
    deleteTarget(call, callback) {
      completeUnary(handleDeleteTarget(runtime, call.request), callback);
    },
    getChatHistoryState(call, callback) {
      completeUnary(handleGetChatHistoryState(runtime, call.request), callback);
    },
    getOverview(_call, callback) {
      completeUnary(handleGetOverview(runtime), callback);
    },
    listChats(call, callback) {
      completeUnary(handleListChats(runtime, call.request), callback);
    },
    listJobs(call, callback) {
      completeUnary(handleListJobs(runtime, call.request), callback);
    },
    requestSync(call, callback) {
      completeUnary(handleRequestSync(runtime, call.request), callback);
    },
    upsertTarget(call, callback) {
      completeUnary(handleUpsertTarget(runtime, call.request), callback);
    }
  };
}

async function handleGetOverview(runtime: HistoryRuntime): Promise<HistoryOverviewResponse> {
  return historyOverviewResponse(
    await callKnownHistoryMethod(runtime, 'history.getOverview', undefined)
  );
}

async function handleListChats(
  runtime: HistoryRuntime,
  request: HistoryListChatsRequest
): Promise<HistoryListChatsResponse> {
  return historyListChatsResponse(
    await callKnownHistoryMethod(runtime, 'history.listChats', listChatsParams(request))
  );
}

async function handleGetChatHistoryState(
  runtime: HistoryRuntime,
  request: HistoryGetChatHistoryStateRequest
): Promise<HistoryChatHistoryStateResponse> {
  return historyChatHistoryStateResponse(
    await callKnownHistoryMethod(runtime, 'history.getChatHistoryState', {
      chatId: request.chatId
    })
  );
}

async function handleUpsertTarget(
  runtime: HistoryRuntime,
  request: HistoryUpsertTargetRequest
): Promise<HistoryTargetMutationResponse> {
  return historyTargetMutationResponse(
    await callKnownHistoryMethod(runtime, 'history.upsertTarget', upsertTargetParams(request))
  );
}

async function handleDeleteTarget(
  runtime: HistoryRuntime,
  request: HistoryDeleteTargetRequest
): Promise<HistoryTargetMutationResponse> {
  return historyTargetMutationResponse(
    await callKnownHistoryMethod(runtime, 'history.deleteTarget', {
      targetId: request.targetId
    })
  );
}

async function handleRequestSync(
  runtime: HistoryRuntime,
  request: HistoryRequestSyncRequest
): Promise<HistoryRequestSyncResponse> {
  const result = asRecord(
    await callKnownHistoryMethod(
      runtime,
      'history.requestSync',
      emptyToUndefined({ chatId: request.chatId })
    )
  );

  return HistoryRequestSyncResponse.create({
    requested: result?.requested === true
  });
}

async function handleListJobs(
  runtime: HistoryRuntime,
  request: HistoryListJobsRequest
): Promise<HistoryListJobsResponse> {
  return historyListJobsResponse(
    await callKnownHistoryMethod(runtime, 'history.listJobs', {
      limit: request.limit,
      status: emptyToUndefined(request.status)
    })
  );
}

async function callKnownHistoryMethod(
  runtime: HistoryRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  const result = await callHistoryMethod(runtime, method, params);
  if (result === undefined) {
    throw new Error(`Unknown method: ${method}`);
  }

  return result;
}

function listChatsParams(request: HistoryListChatsRequest): JsonObject {
  return emptyToUndefined({
    folderId:
      request.list === HistoryChatListKind.HISTORY_CHAT_LIST_KIND_FOLDER
        ? request.folderId
        : undefined,
    limit: request.limit,
    list: historyChatListKindToParam(request.list),
    query: emptyToUndefined(request.query),
    type: emptyToUndefined(request.type)
  });
}

function upsertTargetParams(request: HistoryUpsertTargetRequest): JsonObject {
  return emptyToUndefined({
    chatId: request.chatId,
    end: emptyToUndefined(request.end),
    preset: emptyToUndefined(request.preset),
    range: request.range === undefined ? undefined : historyRangeFromProto(request.range),
    start: emptyToUndefined(request.start),
    targetId: emptyToUndefined(request.targetId)
  });
}

function historyChatListKindToParam(kind: HistoryChatListKind): string | undefined {
  switch (kind) {
    case HistoryChatListKind.HISTORY_CHAT_LIST_KIND_MAIN:
      return 'main';
    case HistoryChatListKind.HISTORY_CHAT_LIST_KIND_ARCHIVE:
      return 'archive';
    case HistoryChatListKind.HISTORY_CHAT_LIST_KIND_FOLDER:
      return 'folder';
    case HistoryChatListKind.HISTORY_CHAT_LIST_KIND_UNSPECIFIED:
    case HistoryChatListKind.UNRECOGNIZED:
      return undefined;
  }
}

function historyOverviewResponse(value: unknown): HistoryOverviewResponse {
  const input = requireRecord(value, 'HistoryOverviewResponse requires object result');
  const activeJob = asRecord(input.activeJob);

  return HistoryOverviewResponse.create({
    activeJob:
      activeJob === undefined
        ? undefined
        : HistoryActiveJob.create({
            chatId: asString(activeJob.chatId) ?? '',
            endAt: toDateText(activeJob.endAt),
            startAt: toDateText(activeJob.startAt),
            status: asString(activeJob.status) ?? ''
          }),
    chats: asUnsignedInteger(input.chats),
    coverageIntervals: asUnsignedInteger(input.coverageIntervals),
    pendingJobs: asUnsignedInteger(input.pendingJobs),
    runningJobs: asUnsignedInteger(input.runningJobs),
    targets: asUnsignedInteger(input.targets),
    templates: asUnsignedInteger(input.templates)
  });
}

function historyListChatsResponse(value: unknown): HistoryListChatsResponse {
  const input = requireRecord(value, 'HistoryListChatsResponse requires object result');
  const navigation = asRecord(input.navigation);

  return HistoryListChatsResponse.create({
    chats: asArray(input.chats).map((chat) => {
      const record = requireRecord(chat, 'History chat requires object');
      return HistoryChat.create({
        coverageIntervals: asUnsignedInteger(record.coverageIntervals),
        coverageNewestAt: toNullableDateText(record.coverageNewestAt),
        coverageOldestAt: toNullableDateText(record.coverageOldestAt),
        id: asString(record.id) ?? '',
        isBot: record.isBot === true,
        pendingJobs: asUnsignedInteger(record.pendingJobs),
        runningJobs: asUnsignedInteger(record.runningJobs),
        targets: asUnsignedInteger(record.targets),
        title: asString(record.title) ?? '',
        type: asString(record.type) ?? '',
        updatedAt: toDateText(record.updatedAt)
      });
    }),
    navigation: HistoryChatNavigation.create({
      archiveCount: asUnsignedInteger(navigation?.archiveCount),
      folders: asArray(navigation?.folders).map((folder) => {
        const record = requireRecord(folder, 'History folder requires object');
        return HistoryChatFolder.create({
          count: asUnsignedInteger(record.count),
          iconName: asString(record.iconName) ?? '',
          id: asUnsignedInteger(record.id),
          position: asUnsignedInteger(record.position),
          title: asString(record.title) ?? ''
        });
      }),
      mainCount: asUnsignedInteger(navigation?.mainCount)
    }),
    types: asArray(input.types).map((typeCount) => {
      const record = requireRecord(typeCount, 'History type count requires object');
      return HistoryChatTypeCount.create({
        count: asUnsignedInteger(record.count),
        type: asString(record.type) ?? ''
      });
    })
  });
}

function historyChatHistoryStateResponse(value: unknown): HistoryChatHistoryStateResponse {
  const input = requireRecord(value, 'HistoryChatHistoryStateResponse requires object result');
  const chat = asRecord(input.chat);

  return HistoryChatHistoryStateResponse.create({
    chat:
      chat === undefined
        ? undefined
        : HistorySelectedChat.create({
            historyBeginningReached: chat.historyBeginningReached === true,
            historyStartAt: toNullableDateText(chat.historyStartAt),
            id: asString(chat.id) ?? '',
            isBot: chat.isBot === true,
            messageCount: asUnsignedInteger(chat.messageCount),
            title: asString(chat.title) ?? '',
            type: asString(chat.type) ?? '',
            updatedAt: toDateText(chat.updatedAt)
          }),
    coverage: asArray(input.coverage).map(historyInterval),
    desired: asArray(input.desired).map(historyInterval),
    jobs: asArray(input.jobs).map(historyJob),
    missing: asArray(input.missing).map(historyInterval),
    targets: asArray(input.targets).map(historyTarget)
  });
}

function historyTargetMutationResponse(value: unknown): HistoryTargetMutationResponse {
  const input = requireRecord(value, 'HistoryTargetMutationResponse requires object result');
  return HistoryTargetMutationResponse.create({
    deleted: input.deleted === true,
    target: historyStoredTarget(input.target),
    upserted: input.upserted === true
  });
}

function historyListJobsResponse(value: unknown): HistoryListJobsResponse {
  const input = requireRecord(value, 'HistoryListJobsResponse requires object result');
  return HistoryListJobsResponse.create({
    jobs: asArray(input.jobs).map(historyJob)
  });
}

function historyTarget(value: unknown): ProtoHistoryTarget {
  const input = requireRecord(value, 'History target requires object');
  return ProtoHistoryTarget.create({
    chatId: asString(input.chatId) ?? '',
    id: asString(input.id) ?? '',
    projected: historyInterval(input.projected),
    range: historyRange(input.range),
    templateId: asString(input.templateId) ?? ''
  });
}

function historyStoredTarget(value: unknown): HistoryStoredTarget | undefined {
  const input = asRecord(value);
  if (input === undefined) {
    return undefined;
  }

  return HistoryStoredTarget.create({
    chatId: asString(input.chatId) ?? '',
    id: asString(input.id) ?? '',
    range: historyRange(input.range),
    templateId: asString(input.templateId) ?? ''
  });
}

function historyInterval(value: unknown): ProtoHistoryInterval {
  const input = requireRecord(value, 'History interval requires object');
  return ProtoHistoryInterval.create({
    endAt: toDateText(input.endAt),
    messageCount: asUnsignedInteger(input.messageCount),
    startAt: toDateText(input.startAt)
  });
}

function historyJob(value: unknown): HistoryJob {
  const input = requireRecord(value, 'History job requires object');
  return HistoryJob.create({
    chatId: asString(input.chatId ?? input.telegramChatId) ?? '',
    cursorJson: input.cursor === undefined ? '' : JSON.stringify(input.cursor),
    endAt: toDateText(input.endAt),
    id: asString(input.id) ?? '',
    startAt: toDateText(input.startAt),
    status: asString(input.status) ?? '',
    updatedAt: toDateText(input.updatedAt)
  });
}

function historyRange(value: unknown): ProtoHistoryRange {
  const input = requireRecord(value, 'History range requires object');
  return ProtoHistoryRange.create({
    end: historyBoundary(input.end),
    start: historyBoundary(input.start)
  });
}

function historyBoundary(value: unknown): ProtoHistoryBoundary {
  const input = requireRecord(value, 'History boundary requires object');
  const kind = asString(input.kind) ?? '';
  return ProtoHistoryBoundary.create({
    at: kind === 'absolute' ? toDateText(input.at) : '',
    expression: kind === 'expression' ? (asString(input.expression) ?? '') : '',
    kind
  });
}

function historyRangeFromProto(range: ProtoHistoryRange): HistoryRange {
  return {
    end: historyBoundaryFromProto(range.end, 'end'),
    start: historyBoundaryFromProto(range.start, 'start')
  };
}

function historyBoundaryFromProto(
  boundary: ProtoHistoryBoundary | undefined,
  name: string
): HistoryBoundary {
  if (boundary === undefined) {
    throw new Error(`History range ${name} boundary is required`);
  }

  if (boundary.kind === 'absolute') {
    return {
      at: boundary.at,
      kind: 'absolute'
    };
  }

  if (boundary.kind === 'expression') {
    return {
      expression: boundary.expression,
      kind: 'expression'
    };
  }

  throw new Error(`History range ${name} boundary kind must be absolute or expression`);
}

function completeUnary<Response>(
  promise: Promise<Response>,
  callback: sendUnaryData<Response>
): void {
  void promise.then(
    (response) => callback(null, response),
    (error: unknown) => callback(toServiceError(error), null)
  );
}

function toServiceError(error: unknown): ServiceError {
  const message = error instanceof Error ? error.message : String(error);
  const serviceError = new Error(message) as ServiceError;
  serviceError.code = status.INTERNAL;
  serviceError.details = message;
  return serviceError;
}

function emptyToUndefined(value: Record<string, unknown>): JsonObject;
function emptyToUndefined(value: string): string | undefined;
function emptyToUndefined(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim().length === 0 ? undefined : value.trim();
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
    );
  }

  return value;
}

function toDateText(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return asString(value) ?? '';
}

function toNullableDateText(value: unknown): string {
  return value === null || value === undefined ? '' : toDateText(value);
}

function asUnsignedInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  const record = asRecord(value);
  if (record === undefined) {
    throw new Error(message);
  }

  return record;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
