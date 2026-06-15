import type { EventBus } from '@agentg/framework';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../src/database/client.js';
import type { FileSubsystem } from '../../src/files/index.js';
import type { GetMessagesInput } from '../../src/procedures/get-messages/contract.js';
import type { HistoryInterval } from '../../src/history/time.js';
import type { MessageState } from '../../src/domain/models/messageState.js';
import type { HistoryJob } from '../../src/storage/reconcilerJobStorage.js';

const jobs = vi.hoisted(() => ({
  claimNextHistoryJob: vi.fn(),
  completeHistoryJob: vi.fn(),
  deferHistoryJob: vi.fn(),
  enqueueHistoryJob: vi.fn(),
  failHistoryJob: vi.fn(),
  readNextHistoryJobRunAt: vi.fn(),
  readHistoryReconcilerStats: vi.fn(),
  releaseHistoryJob: vi.fn()
}));

const readiness = vi.hoisted(() => ({
  checkMessagesReadiness: vi.fn()
}));

const historySource = vi.hoisted(() => ({
  fetchOwnerHistoryStep: vi.fn()
}));

const coverage = vi.hoisted(() => ({
  writeOwnerCoverage: vi.fn()
}));

const messageStorage = vi.hoisted(() => ({
  saveMessageStates: vi.fn()
}));

const framework = vi.hoisted(() => ({
  runWithRootTelemetryContext: vi.fn((operation: () => unknown) => operation())
}));

vi.mock('@agentg/framework', () => ({
  createLogger: () => ({
    error() {
      return undefined;
    },
    info() {
      return undefined;
    },
    warn() {
      return undefined;
    }
  }),
  logError: (error: unknown) => ({
    error
  }),
  runWithRootTelemetryContext: framework.runWithRootTelemetryContext
}));

vi.mock('../../src/storage/reconcilerJobStorage.js', () => jobs);

vi.mock('../../src/repositories/messageReadinessRepository.js', () => readiness);

vi.mock('../../src/reconciler/adapters/historySource.js', () => historySource);

vi.mock('../../src/storage/reconcilerCoverageStorage.js', () => coverage);

vi.mock('../../src/storage/messageStorage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage/messageStorage.js')>();
  return {
    ...actual,
    saveMessageStates: messageStorage.saveMessageStates
  };
});

vi.mock('../../src/reconciler/telemetry.js', () => ({
  errorType: vi.fn((_error: unknown, stage?: string) =>
    stage === 'publish'
      ? 'event_publish_error'
      : stage === 'coverage_check'
        ? 'coverage_write_error'
        : 'unexpected_error'
  ),
  recordCoverageIntervals: vi.fn(),
  recordFailure: vi.fn(),
  recordJobDuration: vi.fn(),
  recordMessages: vi.fn(),
  recordPage: vi.fn(),
  recordStats: vi.fn(),
  recordTransition: vi.fn(),
  timeReconcilerSpan: vi.fn(
    async (_name: string, _attributes: unknown, operation: () => Promise<unknown>) => operation()
  ),
  timeReconcilerTick: vi.fn(async (operation: () => Promise<unknown>) => operation())
}));

import { useHistoryReconciler } from '../../src/reconciler/runtime.js';

describe('Telegram history reconciler runtime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T00:00:00.000Z'));
    jobs.claimNextHistoryJob.mockReset();
    jobs.completeHistoryJob.mockReset();
    jobs.deferHistoryJob.mockReset();
    jobs.enqueueHistoryJob.mockReset();
    jobs.failHistoryJob.mockReset();
    jobs.readNextHistoryJobRunAt.mockReset();
    jobs.readHistoryReconcilerStats.mockReset();
    jobs.releaseHistoryJob.mockReset();
    readiness.checkMessagesReadiness.mockReset();
    historySource.fetchOwnerHistoryStep.mockReset();
    coverage.writeOwnerCoverage.mockReset();
    framework.runWithRootTelemetryContext.mockClear();
    messageStorage.saveMessageStates.mockReset();

    jobs.readHistoryReconcilerStats.mockResolvedValue({
      oldestJobAgeSeconds: [],
      statusCounts: []
    });
    jobs.readNextHistoryJobRunAt.mockResolvedValue(undefined);
    jobs.releaseHistoryJob.mockResolvedValue(undefined);
    coverage.writeOwnerCoverage.mockResolvedValue([]);
    messageStorage.saveMessageStates.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps a pending job active after one fetch when selector readiness still fails', async () => {
    const input: GetMessagesInput = {
      owner: {
        chatId: '123',
        kind: 'chat'
      },
      selector: {
        count: 100,
        kind: 'page'
      }
    };
    const job = {
      ...historyJob(input),
      attemptCount: 0
    };
    const interval = historyInterval();
    const fileSubsystem = fileSubsystemMock();
    const events = eventBusMock();
    const database = transactionDatabase();

    jobs.claimNextHistoryJob.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    readiness.checkMessagesReadiness
      .mockResolvedValueOnce({
        missing: [interval],
        ready: false
      })
      .mockResolvedValueOnce({
        missing: [interval],
        ready: false
      });
    historySource.fetchOwnerHistoryStep.mockResolvedValue({
      coverageInterval: interval,
      fetchedMessages: [telegramMessage()],
      reachedBeginning: false
    });

    const runtime = useHistoryReconciler({
      database,
      events,
      files: fileSubsystem,
      historySource
    });
    const close = await runtime.start();
    await vi.runAllTimersAsync();

    expect(jobs.releaseHistoryJob).toHaveBeenCalledWith(database, job.requestId);
    expect(jobs.completeHistoryJob).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalledWith('telegram.messages.ready', expect.anything());
    expect(fileSubsystem.recordMessageFiles).not.toHaveBeenCalled();
    expect(fileSubsystem.scheduleMessageSlotMaterialization).toHaveBeenCalledTimes(1);
    expect(messageStorage.saveMessageStates).toHaveBeenCalledTimes(1);
    expect(messageStorage.saveMessageStates).toHaveBeenCalledWith(
      expect.anything(),
      [
        expect.objectContaining({
          chatId: '123',
          id: '10'
        })
      ],
      undefined
    );

    close();
  });

  it('publishes ready before deleting the durable job', async () => {
    const order: string[] = [];
    const input: GetMessagesInput = {
      owner: {
        chatId: '123',
        kind: 'chat'
      },
      selector: {
        count: 100,
        kind: 'page'
      }
    };
    const job = {
      ...historyJob(input),
      attemptCount: 0
    };
    const database = transactionDatabase();
    const events = eventBusMock();
    events.publish.mockImplementation((type: string) => {
      if (type === 'telegram.messages.ready') {
        order.push('publish-ready');
      }
    });
    jobs.completeHistoryJob.mockImplementation(() => {
      order.push('complete-job');
      return Promise.resolve();
    });
    jobs.claimNextHistoryJob.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    readiness.checkMessagesReadiness.mockResolvedValue({
      ready: true,
      rows: {
        messages: [],
        reachedStart: true,
        selectorKind: 'page'
      }
    });

    const runtime = useHistoryReconciler({
      database,
      events,
      files: fileSubsystemMock(),
      historySource
    });
    const close = await runtime.start();
    await vi.runAllTimersAsync();

    expect(order).toEqual(['publish-ready', 'complete-job']);

    close();
  });

  it('does not delete a ready job when ready event publish fails', async () => {
    const input: GetMessagesInput = {
      owner: {
        chatId: '123',
        kind: 'chat'
      },
      selector: {
        count: 100,
        kind: 'page'
      }
    };
    const job = {
      ...historyJob(input),
      attemptCount: 0
    };
    const database = transactionDatabase();
    const events = eventBusMock();
    events.publish.mockImplementation((type: string) => {
      if (type === 'telegram.messages.ready') {
        throw new Error('event bus closed');
      }
    });
    jobs.claimNextHistoryJob.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    readiness.checkMessagesReadiness.mockResolvedValue({
      ready: true,
      rows: {
        messages: [],
        reachedStart: true,
        selectorKind: 'page'
      }
    });

    const runtime = useHistoryReconciler({
      database,
      events,
      files: fileSubsystemMock(),
      historySource
    });
    const close = await runtime.start();
    await vi.runAllTimersAsync();

    expect(jobs.completeHistoryJob).not.toHaveBeenCalled();
    expect(jobs.deferHistoryJob).toHaveBeenCalledWith(database, {
      nextRunAt: new Date('2026-06-12T00:00:30.000Z'),
      requestId: job.requestId
    });

    close();
  });

  it('schedules the next deferred job wakeup after a restart tick finds no claimable job', async () => {
    const nextRunAt = new Date('2026-06-12T00:00:30.000Z');
    const database = transactionDatabase();
    jobs.claimNextHistoryJob.mockResolvedValue(null);
    jobs.readNextHistoryJobRunAt.mockResolvedValueOnce(nextRunAt).mockResolvedValue(undefined);

    const runtime = useHistoryReconciler({
      database,
      events: eventBusMock(),
      files: fileSubsystemMock(),
      historySource
    });
    const close = await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(jobs.claimNextHistoryJob).toHaveBeenCalledTimes(1);
    expect(framework.runWithRootTelemetryContext).toHaveBeenCalledTimes(1);
    expect(jobs.readNextHistoryJobRunAt).toHaveBeenCalledWith(database, {
      lockTimeoutMs: 300_000
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(jobs.claimNextHistoryJob).toHaveBeenCalledTimes(2);
    expect(framework.runWithRootTelemetryContext).toHaveBeenCalledTimes(2);

    close();
  });

  it('preempts a future wakeup when a new job is enqueued', async () => {
    const nextRunAt = new Date('2026-06-12T00:15:00.000Z');
    const input = getMessagesInput();
    const requestId = 'telegram.getMessages;selector=page;owner=chat:123;anchor=latest;count=100';
    const database = transactionDatabase();
    jobs.claimNextHistoryJob.mockResolvedValue(null);
    jobs.readNextHistoryJobRunAt.mockResolvedValueOnce(nextRunAt).mockResolvedValue(undefined);
    jobs.enqueueHistoryJob.mockResolvedValue({
      requestId,
      result: 'pending_enqueued'
    });

    const runtime = useHistoryReconciler({
      database,
      events: eventBusMock(),
      files: fileSubsystemMock(),
      historySource
    });
    const close = await runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(jobs.claimNextHistoryJob).toHaveBeenCalledTimes(1);

    await runtime.reconciler.enqueue({
      ...input,
      requestId
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(jobs.claimNextHistoryJob).toHaveBeenCalledTimes(2);

    close();
  });

  it('writes failed state before publishing a terminal failed event', async () => {
    const order: string[] = [];
    const input = getMessagesInput();
    const job = {
      ...historyJob(input),
      attemptCount: 5
    };
    const database = transactionDatabase();
    const events = eventBusMock();
    events.publish.mockImplementation((type: string) => {
      if (type === 'telegram.messages.failed') {
        order.push('publish-failed');
      }
    });
    jobs.failHistoryJob.mockImplementation(() => {
      order.push('fail-job');
      return Promise.resolve();
    });
    jobs.claimNextHistoryJob.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    readiness.checkMessagesReadiness.mockRejectedValue(new Error('unexpected read failure'));

    const runtime = useHistoryReconciler({
      database,
      events,
      files: fileSubsystemMock(),
      historySource
    });
    const close = await runtime.start();
    await vi.runAllTimersAsync();

    expect(order).toEqual(['fail-job', 'publish-failed']);

    close();
  });

  it('does not keep a terminal failed job running when failed event publish throws', async () => {
    const input = getMessagesInput();
    const job = {
      ...historyJob(input),
      attemptCount: 5
    };
    const database = transactionDatabase();
    const events = eventBusMock();
    events.publish.mockImplementation((type: string) => {
      if (type === 'telegram.messages.failed') {
        throw new Error('event bus closed');
      }
    });
    jobs.claimNextHistoryJob.mockResolvedValueOnce(job).mockResolvedValueOnce(null);
    readiness.checkMessagesReadiness.mockRejectedValue(new Error('unexpected read failure'));

    const runtime = useHistoryReconciler({
      database,
      events,
      files: fileSubsystemMock(),
      historySource
    });
    const close = await runtime.start();
    await vi.runAllTimersAsync();

    expect(jobs.failHistoryJob).toHaveBeenCalledWith(database, {
      reason: 'coverage_write_error',
      requestId: job.requestId
    });

    close();
  });
});

function historyJob(input: GetMessagesInput): HistoryJob {
  return {
    attemptCount: 1,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    lockedAt: new Date('2026-06-12T00:00:00.000Z'),
    nextRunAt: new Date('2026-06-12T00:00:00.000Z'),
    owner: input.owner,
    ownerKey: 'chat:123',
    ownerKind: 'chat',
    requestId: 'telegram.getMessages;selector=page;owner=chat:123;anchor=latest;count=100',
    selector: input.selector,
    status: 'running',
    updatedAt: new Date('2026-06-12T00:00:00.000Z')
  };
}

function transactionDatabase(): Database {
  return {
    transaction(operation: (transaction: Database) => Promise<unknown>) {
      return operation({} as Database);
    }
  } as unknown as Database;
}

function historyInterval(): HistoryInterval {
  return {
    endAt: new Date('2026-06-12T00:00:00.000Z'),
    startAt: new Date('2026-06-11T23:00:00.000Z')
  };
}

function getMessagesInput(): GetMessagesInput {
  return {
    owner: {
      chatId: '123',
      kind: 'chat'
    },
    selector: {
      count: 100,
      kind: 'page'
    }
  };
}

function telegramMessage(): MessageState {
  return {
    chatId: '123',
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: 'hello'
      }
    },
    date: new Date('2026-06-11T23:00:00.000Z'),
    id: '10',
    interactionInfo: null,
    isOutgoing: false,
    replyTo: null,
    senderId: {
      _: 'messageSenderUser',
      user_id: 1
    },
    sendingState: null,
    topicId: null
  };
}

function eventBusMock(): EventBus & { publish: ReturnType<typeof vi.fn> } {
  const publish = vi.fn();
  return {
    publish,
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    subscribe() {
      return {
        unsubscribe() {
          return undefined;
        }
      };
    }
  };
}

function fileSubsystemMock(): FileSubsystem & {
  recordMessageFiles: ReturnType<typeof vi.fn>;
  scheduleMessageSlotMaterialization: ReturnType<typeof vi.fn>;
} {
  return {
    recordMessageFiles: vi.fn(),
    scheduleMessageSlotMaterialization: vi.fn()
  } as unknown as FileSubsystem & {
    recordMessageFiles: ReturnType<typeof vi.fn>;
    scheduleMessageSlotMaterialization: ReturnType<typeof vi.fn>;
  };
}
