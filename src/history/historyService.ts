import { createHash } from 'node:crypto';

import type { EventBus, EventSubscription } from '../bus/eventBus.js';
import { createAppEvent, type AppEvent } from '../bus/events.js';
import type { TelegramService } from '../telegram/telegramService.js';
import type { TelegramChatDto } from '../telegram/telegramRepository.js';
import type { HistoryCoverageInterval } from './coverage.js';
import type { HistoryJob } from './jobs.js';
import { createLiveCoverageObserver } from './liveCoverage.js';
import type {
  HistoryBoundary,
  HistoryChatStats,
  HistoryMessage,
  HistoryRange,
  HistoryRepository,
  HistoryTarget
} from './historyRepository.js';
import { reconcileChat, type HistoryTarget as ReconcilerHistoryTarget } from './reconciler.js';

const HISTORY_LIVE_COVERAGE_TICK_MS = 5000;

export type HistoryService = {
  createBackfillJobs(input: CreateBackfillJobsInput): HistoryJob[];
  deleteTarget(targetId: string): HistoryTargetMutationResult;
  getChatHistoryState(chatId: string): Promise<HistoryChatHistoryState>;
  getCoverage(chatId: string): HistoryCoverageInterval[];
  getOverview(): HistoryOverview;
  listChats(input: HistoryChatListInput): HistoryChatListResult;
  listMessages(chatId: string): HistoryMessage[];
  start(): void;
  stop(): Promise<void>;
  upsertTarget(input: HistoryTargetUpsertInput): HistoryTargetMutationResult;
};

export type HistoryServiceDependencies = {
  eventBus: EventBus;
  repository: HistoryRepository;
  telegramService: TelegramService;
};

export type CreateBackfillJobsInput = {
  chatId: string;
  targets: ReconcilerHistoryTarget[];
  jobWindowMilliseconds?: number;
};

export type HistoryOverview = {
  activeJob: null;
  chats: number;
  coverageIntervals: number;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
  templates: number;
};

export type HistoryChatListInput = {
  folderId?: number | null;
  limit?: number;
  list?: 'archive' | 'folder' | 'main';
  query?: string;
};

export type HistoryChatListResult = {
  chats: HistoryChatSummary[];
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
  types: {
    count: number;
    type: string;
  }[];
};

export type HistoryChatSummary = {
  coverageIntervals: number;
  id: string;
  isBot: boolean;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
  title: string;
  type: string;
  updatedAt: string;
};

export type HistoryChatHistoryState = {
  chat: {
    historyBeginningReached: boolean;
    historyStartAt: string | null;
    id: string;
    isBot: boolean;
    messageCount: number;
    title: string;
    type: string;
    updatedAt: string;
  } | null;
  coverage: HistoryIntervalOutput[];
  desired: HistoryIntervalOutput[];
  jobs: HistoryJobOutput[];
  missing: HistoryIntervalOutput[];
  targets: (HistoryTarget & {
    projected?: HistoryIntervalOutput;
  })[];
};

export type HistoryIntervalOutput = {
  endAt: string;
  messageCount?: number;
  startAt: string;
};

export type HistoryJobOutput = {
  endAt: string;
  id: string;
  startAt: string;
  status: string;
  updatedAt: string;
};

export type HistoryTargetUpsertInput =
  | {
      chatId: string;
      end: string;
      start: string;
      targetId?: string;
    }
  | {
      chatId: string;
      preset: string;
      targetId?: string;
    };

export type HistoryTargetMutationResult = {
  deleted?: boolean;
  target?: HistoryTarget;
  upserted?: boolean;
};

export function createHistoryService(dependencies: HistoryServiceDependencies): HistoryService {
  let subscriptions: EventSubscription[] = [];
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  const liveCoverageObserver = createLiveCoverageObserver({
    addCoverageBatch(intervals): Promise<void> {
      for (const interval of intervals) {
        dependencies.repository.addCoverage(interval);
      }
      return Promise.resolve();
    },
    listChatIds(): Promise<string[]> {
      return Promise.resolve(dependencies.telegramService.listChats().map((chat) => chat.id));
    },
    publishCoverageChanged(intervals): Promise<void> {
      return publishLiveCoverageChanged(dependencies.eventBus, intervals);
    }
  });

  return {
    createBackfillJobs(input): HistoryJob[] {
      const coverage = dependencies.repository.listCoverage(input.chatId);
      const jobs = reconcileChat({
        chatId: input.chatId,
        coverage,
        ...(input.jobWindowMilliseconds === undefined
          ? {}
          : { jobWindowMilliseconds: input.jobWindowMilliseconds }),
        targets: input.targets
      });

      return dependencies.repository.createJobs(jobs);
    },
    deleteTarget(targetId): HistoryTargetMutationResult {
      const target = dependencies.repository.deleteTarget(targetId);
      if (target === undefined) {
        throw new Error(`Unknown history target: ${targetId}`);
      }

      return {
        deleted: true,
        target
      };
    },
    async getChatHistoryState(chatId): Promise<HistoryChatHistoryState> {
      const chat = await dependencies.telegramService.getChat(chatId);
      if (chat === undefined) {
        return {
          chat: null,
          coverage: [],
          desired: [],
          jobs: [],
          missing: [],
          targets: []
        };
      }

      const messageCount = dependencies.repository.countMessages(chatId);
      const coverage = dependencies.repository.listCoverage(chatId);
      const targets = dependencies.repository.listTargets(chatId);

      return {
        chat: {
          historyBeginningReached: false,
          historyStartAt: null,
          id: chat.id,
          isBot: false,
          messageCount,
          title: chat.title,
          type: chat.type,
          updatedAt: chat.updatedAt
        },
        coverage: coverage.map((interval) => coverageIntervalOutput(interval, messageCount)),
        desired: [],
        jobs: dependencies.repository.listJobs(chatId).map(jobOutput),
        missing: [],
        targets
      };
    },
    getCoverage(chatId): HistoryCoverageInterval[] {
      return dependencies.repository.listCoverage(chatId);
    },
    getOverview(): HistoryOverview {
      return {
        activeJob: null,
        chats: dependencies.telegramService.countChats(),
        coverageIntervals: dependencies.repository.countCoverageIntervals(),
        pendingJobs: 0,
        runningJobs: 0,
        targets: dependencies.repository.countTargets(),
        templates: 0
      };
    },
    listChats(input): HistoryChatListResult {
      const chats = dependencies.telegramService.listChats({
        ...(input.folderId === undefined ? {} : { folderId: input.folderId }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.list === undefined ? {} : { list: input.list }),
        ...(input.query === undefined ? {} : { query: input.query })
      });
      const stats = dependencies.repository.listChatStats(chats.map((chat) => chat.id));

      return {
        chats: chats.map((chat) =>
          chatSummary(chat, stats.get(chat.id) ?? emptyHistoryChatStats())
        ),
        navigation: {
          archiveCount: dependencies.telegramService.countChats({ list: 'archive' }),
          folders: dependencies.telegramService.listChatFolders(),
          mainCount: dependencies.telegramService.countChats({ list: 'main' })
        },
        types: dependencies.telegramService.listChatTypeCounts()
      };
    },
    listMessages(chatId): HistoryMessage[] {
      return dependencies.repository.listMessages(chatId);
    },
    start(): void {
      if (subscriptions.length > 0) {
        return;
      }

      subscriptions = [
        dependencies.eventBus.subscribe('telegram.message.created', async (event) => {
          const message = await recordTelegramMessageEvent(dependencies, event);
          if (message?.messageDate !== undefined) {
            await liveCoverageObserver.recordLiveMessage(
              message.chatId,
              new Date(message.messageDate),
              new Date(event.occurredAt)
            );
          }
        }),
        dependencies.eventBus.subscribe('telegram.message.updated', async (event) => {
          await recordTelegramMessageEvent(dependencies, event);
        }),
        dependencies.eventBus.subscribe('telegram.tdlib.status', (event) =>
          handleTelegramTdlibStatus(liveCoverageObserver, event)
        )
      ];
      liveCoverageTick = setInterval(() => {
        void liveCoverageObserver.tick();
      }, HISTORY_LIVE_COVERAGE_TICK_MS);
      liveCoverageTick.unref();
    },
    async stop(): Promise<void> {
      if (liveCoverageTick !== undefined) {
        clearInterval(liveCoverageTick);
        liveCoverageTick = undefined;
      }
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      subscriptions = [];
      await liveCoverageObserver.markDisconnected();
      await liveCoverageObserver.wait();
    },
    upsertTarget(input): HistoryTargetMutationResult {
      const range = targetRangeFromInput(input);
      const target = dependencies.repository.upsertTarget({
        chatId: input.chatId,
        id: input.targetId ?? manualTargetId(input.chatId, range),
        range
      });

      return {
        target,
        upserted: true
      };
    }
  };
}

async function recordTelegramMessageEvent(
  dependencies: HistoryServiceDependencies,
  event: AppEvent
): Promise<HistoryMessage | undefined> {
  const messageReference = readTelegramMessageReference(event);
  if (messageReference === undefined) {
    return undefined;
  }

  const message = await dependencies.telegramService.getMessage(
    messageReference.chatId,
    messageReference.messageId
  );
  if (message?.messageDate === undefined) {
    return undefined;
  }

  const observedAt = new Date(event.occurredAt);
  const recorded = dependencies.repository.recordTelegramMessage(message, observedAt);

  if (recorded !== undefined) {
    await dependencies.eventBus.publish(
      createAppEvent({
        data: {
          chatId: recorded.chatId,
          messageId: recorded.messageId
        },
        meta: {
          chatId: recorded.chatId,
          messageId: recorded.messageId
        },
        source: 'history',
        type: 'history.message.recorded'
      })
    );
  }

  return recorded;
}

async function handleTelegramTdlibStatus(
  liveCoverageObserver: ReturnType<typeof createLiveCoverageObserver>,
  event: AppEvent
): Promise<void> {
  const data = readRecord(event.data);
  if (data?.connected === true) {
    await liveCoverageObserver.markConnected(new Date(event.occurredAt));
    return;
  }

  await liveCoverageObserver.markDisconnected();
}

async function publishLiveCoverageChanged(
  eventBus: EventBus,
  intervals: HistoryCoverageInterval[]
): Promise<void> {
  if (intervals.length === 0) {
    return;
  }

  await eventBus.publish(
    createAppEvent({
      data: {
        chatCount: new Set(intervals.map((interval) => interval.chatId)).size,
        endAt: maxDateFromList(intervals.map((interval) => interval.endAt)).toISOString(),
        intervalCount: intervals.length,
        startAt: minDateFromList(intervals.map((interval) => interval.startAt)).toISOString()
      },
      source: 'history',
      type: 'history.coverage.changed'
    })
  );
}

function readTelegramMessageReference(event: AppEvent):
  | {
      chatId: string;
      messageId: string;
    }
  | undefined {
  const meta = event.meta;
  if (typeof meta?.chatId === 'string' && typeof meta.messageId === 'string') {
    return {
      chatId: meta.chatId,
      messageId: meta.messageId
    };
  }

  const message = readRecord(event.data.message);
  if (typeof message?.chatId === 'string' && typeof message.messageId === 'string') {
    return {
      chatId: message.chatId,
      messageId: message.messageId
    };
  }

  return undefined;
}

function chatSummary(chat: TelegramChatDto, stats: HistoryChatStats): HistoryChatSummary {
  return {
    coverageIntervals: stats.coverageIntervals,
    id: chat.id,
    isBot: chat.type === 'bot',
    pendingJobs: stats.pendingJobs,
    runningJobs: stats.runningJobs,
    targets: stats.targets,
    title: chat.title,
    type: chat.type,
    updatedAt: chat.updatedAt
  };
}

function emptyHistoryChatStats(): HistoryChatStats {
  return {
    coverageIntervals: 0,
    messageCount: 0,
    pendingJobs: 0,
    runningJobs: 0,
    targets: 0
  };
}

function coverageIntervalOutput(
  interval: HistoryCoverageInterval,
  messageCount: number
): HistoryIntervalOutput {
  return {
    endAt: interval.endAt.toISOString(),
    messageCount,
    startAt: interval.startAt.toISOString()
  };
}

function jobOutput(job: HistoryJob): HistoryJobOutput {
  return {
    endAt: job.endAt.toISOString(),
    id: String(job.id),
    startAt: job.startAt.toISOString(),
    status: job.status,
    updatedAt: job.createdAt
  };
}

function targetRangeFromInput(input: HistoryTargetUpsertInput): HistoryRange {
  if ('preset' in input) {
    return presetRange(input.preset);
  }

  return {
    end: parseBoundary(input.end),
    start: parseBoundary(input.start)
  };
}

function presetRange(preset: string): HistoryRange {
  switch (preset) {
    case 'last7d':
      return expressionRange('now-7d', 'now');
    case 'last30d':
      return expressionRange('now-30d', 'now');
    case 'full':
      return expressionRange('past', 'now');
    default:
      throw new Error(`Unknown history target preset: ${preset}`);
  }
}

function expressionRange(start: string, end: string): HistoryRange {
  return {
    end: {
      expression: end,
      kind: 'expression'
    },
    start: {
      expression: start,
      kind: 'expression'
    }
  };
}

function parseBoundary(value: string): HistoryBoundary {
  const text = value.trim();
  if (text.length === 0) {
    throw new Error('History target boundary must not be empty');
  }

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return {
      at: parsedDate.toISOString(),
      kind: 'absolute'
    };
  }

  return {
    expression: text,
    kind: 'expression'
  };
}

function manualTargetId(chatId: string, range: HistoryRange): string {
  return `manual:${chatId}:${shortHash(`${chatId}:${JSON.stringify(range)}`)}`;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function minDate(first: Date, ...rest: Date[]): Date;
function minDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDate requires at least one date');
  }
  return rest.reduce((minimum, date) => (date < minimum ? date : minimum), first);
}

function minDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('minDateFromList requires at least one date');
  }
  return minDate(first, ...rest);
}

function maxDate(first: Date, ...rest: Date[]): Date;
function maxDate(...dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDate requires at least one date');
  }
  return rest.reduce((maximum, date) => (date > maximum ? date : maximum), first);
}

function maxDateFromList(dates: Date[]): Date {
  const [first, ...rest] = dates;
  if (first === undefined) {
    throw new Error('maxDateFromList requires at least one date');
  }
  return maxDate(first, ...rest);
}
