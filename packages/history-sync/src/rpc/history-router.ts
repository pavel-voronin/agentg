import {
  historyChatHistoryStateOutputSchema,
  historyDeleteTargetInputSchema,
  historyGetChatHistoryStateInputSchema,
  historyGetOverviewInputSchema,
  historyListChatsInputSchema,
  historyListChatsOutputSchema,
  historyListJobsInputSchema,
  historyListJobsOutputSchema,
  historyOverviewOutputSchema,
  historyRequestSyncInputSchema,
  historyRequestSyncOutputSchema,
  historyTargetMutationOutputSchema,
  historyUpsertTargetInputSchema,
  type HistoryChatHistoryStateOutput,
  type HistoryIntervalOutput,
  type HistoryJobOutput,
  type HistoryListChatsOutput,
  type HistoryListJobsOutput,
  type HistoryOverviewOutput,
  type HistoryRequestSyncOutput,
  type HistoryStoredTargetOutput,
  type HistoryTargetOutput,
  type HistoryTargetMutationOutput
} from './history-contracts.js';
import { callHistoryMethod, type HistoryRuntime } from '../observability.js';
import { historyRpcProcedure, historyRpcRouter } from './trpc.js';

type HistoryMethod =
  | 'history.deleteTarget'
  | 'history.getChatHistoryState'
  | 'history.getOverview'
  | 'history.listChats'
  | 'history.listJobs'
  | 'history.requestSync'
  | 'history.upsertTarget';

export type HistoryMethodCaller = (
  runtime: HistoryRuntime,
  method: HistoryMethod,
  params: unknown
) => Promise<unknown>;

export type CreateHistoryRouterOptions = HistoryRuntime & {
  callMethod?: HistoryMethodCaller;
};

export function createHistoryRouter(options: CreateHistoryRouterOptions) {
  const callMethod = options.callMethod ?? callHistoryMethod;

  return historyRpcRouter({
    deleteTarget: historyRpcProcedure
      .input(historyDeleteTargetInputSchema)
      .output(historyTargetMutationOutputSchema)
      .mutation(async ({ input }) =>
        normalizeTargetMutation(
          await callKnownHistoryMethod(options, callMethod, 'history.deleteTarget', input)
        )
      ),
    getChatHistoryState: historyRpcProcedure
      .input(historyGetChatHistoryStateInputSchema)
      .output(historyChatHistoryStateOutputSchema)
      .query(async ({ input }) =>
        normalizeChatHistoryState(
          await callKnownHistoryMethod(options, callMethod, 'history.getChatHistoryState', input)
        )
      ),
    getOverview: historyRpcProcedure
      .input(historyGetOverviewInputSchema)
      .output(historyOverviewOutputSchema)
      .query(async () =>
        normalizeOverview(
          await callKnownHistoryMethod(options, callMethod, 'history.getOverview', undefined)
        )
      ),
    listChats: historyRpcProcedure
      .input(historyListChatsInputSchema)
      .output(historyListChatsOutputSchema)
      .query(async ({ input }) =>
        normalizeListChats(
          await callKnownHistoryMethod(options, callMethod, 'history.listChats', input)
        )
      ),
    listJobs: historyRpcProcedure
      .input(historyListJobsInputSchema)
      .output(historyListJobsOutputSchema)
      .query(async ({ input }) =>
        normalizeListJobs(
          await callKnownHistoryMethod(options, callMethod, 'history.listJobs', input)
        )
      ),
    requestSync: historyRpcProcedure
      .input(historyRequestSyncInputSchema)
      .output(historyRequestSyncOutputSchema)
      .mutation(async ({ input }) =>
        normalizeRequestSync(
          await callKnownHistoryMethod(options, callMethod, 'history.requestSync', input)
        )
      ),
    upsertTarget: historyRpcProcedure
      .input(historyUpsertTargetInputSchema)
      .output(historyTargetMutationOutputSchema)
      .mutation(async ({ input }) =>
        normalizeTargetMutation(
          await callKnownHistoryMethod(options, callMethod, 'history.upsertTarget', input)
        )
      )
  });
}

export type HistoryRouter = ReturnType<typeof createHistoryRouter>;

async function callKnownHistoryMethod(
  runtime: HistoryRuntime,
  callMethod: HistoryMethodCaller,
  method: HistoryMethod,
  params: unknown
): Promise<unknown> {
  const result = await callMethod(runtime, method, params);
  if (result === undefined) {
    throw new Error(`Unknown method: ${method}`);
  }

  return result;
}

function normalizeOverview(value: unknown): HistoryOverviewOutput {
  const input = requireRecord(value, 'History overview requires object result');
  const activeJob = asRecord(input.activeJob);

  return {
    activeJob:
      activeJob === undefined
        ? null
        : {
            chatId: asString(activeJob.chatId) ?? '',
            endAt: toDateText(activeJob.endAt),
            startAt: toDateText(activeJob.startAt),
            status: asString(activeJob.status) ?? ''
          },
    chats: asNonNegativeInteger(input.chats),
    coverageIntervals: asNonNegativeInteger(input.coverageIntervals),
    pendingJobs: asNonNegativeInteger(input.pendingJobs),
    runningJobs: asNonNegativeInteger(input.runningJobs),
    targets: asNonNegativeInteger(input.targets),
    templates: asNonNegativeInteger(input.templates)
  };
}

function normalizeListChats(value: unknown): HistoryListChatsOutput {
  const input = requireRecord(value, 'History chat list requires object result');
  const navigation = asRecord(input.navigation);

  return {
    chats: asArray(input.chats).map((chat) => {
      const record = requireRecord(chat, 'History chat requires object');

      return {
        coverageIntervals: asNonNegativeInteger(record.coverageIntervals),
        coverageNewestAt: toNullableDateText(record.coverageNewestAt),
        coverageOldestAt: toNullableDateText(record.coverageOldestAt),
        id: asString(record.id) ?? '',
        isBot: record.isBot === true,
        pendingJobs: asNonNegativeInteger(record.pendingJobs),
        runningJobs: asNonNegativeInteger(record.runningJobs),
        targets: asNonNegativeInteger(record.targets),
        title: asString(record.title) ?? '',
        type: asString(record.type) ?? '',
        updatedAt: toDateText(record.updatedAt)
      };
    }),
    navigation: {
      archiveCount: asNonNegativeInteger(navigation?.archiveCount),
      folders: asArray(navigation?.folders).map((folder) => {
        const record = requireRecord(folder, 'History folder requires object');

        return {
          count: asNonNegativeInteger(record.count),
          iconName: asString(record.iconName) ?? null,
          id: asNonNegativeInteger(record.id),
          position: asNonNegativeInteger(record.position),
          title: asString(record.title) ?? ''
        };
      }),
      mainCount: asNonNegativeInteger(navigation?.mainCount)
    },
    types: asArray(input.types).map((typeCount) => {
      const record = requireRecord(typeCount, 'History type count requires object');

      return {
        count: asNonNegativeInteger(record.count),
        type: asString(record.type) ?? ''
      };
    })
  };
}

function normalizeChatHistoryState(value: unknown): HistoryChatHistoryStateOutput {
  const input = requireRecord(value, 'History chat state requires object result');
  const chat = asRecord(input.chat);

  return {
    chat:
      chat === undefined
        ? null
        : {
            historyBeginningReached: chat.historyBeginningReached === true,
            historyStartAt: toNullableDateText(chat.historyStartAt),
            id: asString(chat.id) ?? '',
            isBot: chat.isBot === true,
            messageCount: asNonNegativeInteger(chat.messageCount),
            title: asString(chat.title) ?? '',
            type: asString(chat.type) ?? '',
            updatedAt: toDateText(chat.updatedAt)
          },
    coverage: asArray(input.coverage).map((interval) => normalizeInterval(interval, true)),
    desired: asArray(input.desired).map((interval) => normalizeInterval(interval, false)),
    jobs: asArray(input.jobs).map((job) => normalizeJob(job, false)),
    missing: asArray(input.missing).map((interval) => normalizeInterval(interval, false)),
    targets: asArray(input.targets).map(normalizeTarget)
  };
}

function normalizeTargetMutation(value: unknown): HistoryTargetMutationOutput {
  const input = requireRecord(value, 'History target mutation requires object result');
  const target = normalizeStoredTarget(input.target);

  return removeUndefinedProperties({
    deleted: input.deleted === true,
    target,
    upserted: input.upserted === true
  }) as HistoryTargetMutationOutput;
}

function normalizeRequestSync(value: unknown): HistoryRequestSyncOutput {
  const input = requireRecord(value, 'History sync request requires object result');

  return {
    requested: input.requested === true
  };
}

function normalizeListJobs(value: unknown): HistoryListJobsOutput {
  const input = requireRecord(value, 'History job list requires object result');

  return {
    jobs: asArray(input.jobs).map((job) => normalizeJob(job, true))
  };
}

function normalizeTarget(value: unknown): HistoryTargetOutput {
  const input = requireRecord(value, 'History target requires object');
  const projected = asRecord(input.projected);

  return removeUndefinedProperties({
    chatId: asString(input.chatId) ?? '',
    id: asString(input.id) ?? '',
    projected:
      projected === undefined
        ? undefined
        : {
            endAt: toDateText(projected.endAt),
            startAt: toDateText(projected.startAt)
          },
    range: normalizeRange(input.range),
    templateId: input.templateId === null ? null : asString(input.templateId)
  }) as HistoryTargetOutput;
}

function normalizeStoredTarget(value: unknown): HistoryStoredTargetOutput | undefined {
  const input = asRecord(value);
  if (input === undefined) {
    return undefined;
  }

  return removeUndefinedProperties({
    chatId: asString(input.chatId) ?? '',
    id: asString(input.id) ?? '',
    range: normalizeRange(input.range),
    templateId: asString(input.templateId)
  }) as HistoryStoredTargetOutput;
}

function normalizeInterval(value: unknown, includeMessageCount: boolean): HistoryIntervalOutput {
  const input = requireRecord(value, 'History interval requires object');

  return removeUndefinedProperties({
    endAt: toDateText(input.endAt),
    messageCount: includeMessageCount ? asNonNegativeInteger(input.messageCount) : undefined,
    startAt: toDateText(input.startAt)
  }) as HistoryIntervalOutput;
}

function normalizeJob(value: unknown, includeTelegramChatId: boolean): HistoryJobOutput {
  const input = requireRecord(value, 'History job requires object');
  const telegramChatId = asString(input.telegramChatId ?? input.chatId);

  return removeUndefinedProperties({
    cursor: input.cursor,
    endAt: toDateText(input.endAt),
    id: asString(input.id) ?? '',
    startAt: toDateText(input.startAt),
    status: asString(input.status) ?? '',
    telegramChatId: includeTelegramChatId ? telegramChatId : undefined,
    updatedAt: toDateText(input.updatedAt)
  }) as HistoryJobOutput;
}

function normalizeRange(value: unknown) {
  const input = requireRecord(value, 'History range requires object');

  return {
    end: normalizeBoundary(input.end, 'end'),
    start: normalizeBoundary(input.start, 'start')
  };
}

function normalizeBoundary(value: unknown, name: string) {
  const input = requireRecord(value, `History range ${name} boundary requires object`);
  const kind = asString(input.kind);

  if (kind === 'absolute') {
    return {
      at: toDateText(input.at),
      kind
    };
  }

  if (kind === 'expression') {
    return {
      expression: asString(input.expression) ?? '',
      kind
    };
  }

  throw new Error(`History range ${name} boundary kind must be absolute or expression`);
}

function toDateText(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return asString(value) ?? '';
}

function toNullableDateText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = toDateText(value);
  return text.length === 0 ? null : text;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
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

function removeUndefinedProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
