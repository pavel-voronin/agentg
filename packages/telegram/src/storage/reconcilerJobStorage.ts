import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm';

import { toJsonValue, type JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramHistoryReconcilerJobs } from '../database/schema.js';
import {
  messageReadRequestSchema,
  messageSelectorSchema,
  type MessageReadRequest,
  type MessageOwner,
  type MessageSelector
} from '../domain/models/messageSelection.js';
import { normalizeMessageOwner } from '../domain/models/messageSelection.js';

export type JobStatus = 'deferred' | 'failed' | 'queued' | 'running';

export type EnqueueResult = {
  requestId: string;
  result: 'pending_coalesced' | 'pending_enqueued';
};

export type HistoryJob = {
  attemptCount: number;
  createdAt: Date;
  lockedAt: Date | null;
  nextRunAt: Date;
  owner: MessageOwner;
  ownerKind: string;
  ownerKey: string;
  requestId: string;
  selector: MessageSelector;
  status: JobStatus;
  updatedAt: Date;
};

export type ReconcilerStats = {
  oldestJobAgeSeconds: {
    ownerKind: string;
    status: JobStatus;
    value: number;
  }[];
  statusCounts: {
    count: number;
    ownerKind: string;
    status: JobStatus;
  }[];
};

const ACTIVE_STATUSES: JobStatus[] = ['deferred', 'queued', 'running'];

export async function enqueueHistoryJob(
  database: Database,
  input: MessageReadRequest & { requestId: string },
  now = new Date()
): Promise<EnqueueResult> {
  const normalized = normalizeMessageOwner(input.owner);

  for (;;) {
    const existingResult = await coalesceOrRequeueExistingHistoryJob(
      database,
      input,
      normalized,
      now
    );
    if (existingResult !== null) {
      return existingResult;
    }

    const [inserted] = await database
      .insert(telegramHistoryReconcilerJobs)
      .values(historyJobInsertValue(input, normalized, now))
      .onConflictDoNothing({
        target: telegramHistoryReconcilerJobs.requestId
      })
      .returning({
        requestId: telegramHistoryReconcilerJobs.requestId
      });

    if (inserted !== undefined) {
      return {
        requestId: input.requestId,
        result: 'pending_enqueued'
      };
    }
  }
}

async function coalesceOrRequeueExistingHistoryJob(
  database: Database,
  input: MessageReadRequest & { requestId: string },
  normalized: ReturnType<typeof normalizeMessageOwner>,
  now: Date
): Promise<EnqueueResult | null> {
  const [existing] = await database
    .select({
      status: telegramHistoryReconcilerJobs.status
    })
    .from(telegramHistoryReconcilerJobs)
    .where(eq(telegramHistoryReconcilerJobs.requestId, input.requestId))
    .limit(1);

  if (existing === undefined) {
    return coalesceOverlappingActiveRangeJob(database, input, normalized, now);
  }

  if (ACTIVE_STATUSES.includes(existing.status as JobStatus)) {
    await database
      .update(telegramHistoryReconcilerJobs)
      .set({
        updatedAt: sql`now()`
      })
      .where(eq(telegramHistoryReconcilerJobs.requestId, input.requestId));
    return {
      requestId: input.requestId,
      result: 'pending_coalesced'
    };
  }

  await database
    .update(telegramHistoryReconcilerJobs)
    .set({
      attemptCount: 0,
      lastFailureReason: null,
      lockedAt: null,
      nextRunAt: now,
      owner: toJsonValue(input.owner),
      ownerKey: normalized.key,
      ownerKind: normalized.kind,
      selector: toJsonValue(input.selector),
      selectorKind: input.selector.kind,
      status: 'queued',
      updatedAt: sql`now()`
    })
    .where(eq(telegramHistoryReconcilerJobs.requestId, input.requestId));
  return {
    requestId: input.requestId,
    result: 'pending_enqueued'
  };
}

async function coalesceOverlappingActiveRangeJob(
  database: Database,
  input: MessageReadRequest & { requestId: string },
  normalized: ReturnType<typeof normalizeMessageOwner>,
  now: Date
): Promise<EnqueueResult | null> {
  if (input.selector.kind !== 'range') {
    return null;
  }

  const rows = await database
    .select({
      requestId: telegramHistoryReconcilerJobs.requestId,
      selector: telegramHistoryReconcilerJobs.selector
    })
    .from(telegramHistoryReconcilerJobs)
    .where(
      and(
        eq(telegramHistoryReconcilerJobs.ownerKey, normalized.key),
        eq(telegramHistoryReconcilerJobs.selectorKind, 'range'),
        inArray(telegramHistoryReconcilerJobs.status, ['queued', 'deferred'])
      )
    )
    .limit(1);

  for (const row of rows) {
    const selector = messageSelectorSchema.parse(row.selector);
    if (selector.kind !== 'range') {
      continue;
    }
    if (!rangesOverlap(selector, input.selector)) {
      continue;
    }

    await database
      .update(telegramHistoryReconcilerJobs)
      .set({
        attemptCount: 0,
        lastFailureReason: null,
        lockedAt: null,
        nextRunAt: now,
        selector: toJsonValue(mergeRanges(selector, input.selector)),
        selectorKind: 'range',
        status: 'queued',
        updatedAt: sql`now()`
      })
      .where(eq(telegramHistoryReconcilerJobs.requestId, row.requestId));
    return {
      requestId: row.requestId,
      result: 'pending_coalesced'
    };
  }

  return null;
}

function historyJobInsertValue(
  input: MessageReadRequest & { requestId: string },
  normalized: ReturnType<typeof normalizeMessageOwner>,
  now: Date
) {
  return {
    attemptCount: 0,
    lastFailureReason: null,
    lockedAt: null,
    nextRunAt: now,
    owner: toJsonValue(input.owner),
    ownerKey: normalized.key,
    ownerKind: normalized.kind,
    requestId: input.requestId,
    selector: toJsonValue(input.selector),
    selectorKind: input.selector.kind,
    status: 'queued',
    updatedAt: sql`now()`
  };
}

function rangesOverlap(
  first: Extract<MessageSelector, { kind: 'range' }>,
  second: Extract<MessageSelector, { kind: 'range' }>
): boolean {
  return (
    new Date(first.startAt) <= new Date(second.endAt) &&
    new Date(second.startAt) <= new Date(first.endAt)
  );
}

function mergeRanges(
  first: Extract<MessageSelector, { kind: 'range' }>,
  second: Extract<MessageSelector, { kind: 'range' }>
): Extract<MessageSelector, { kind: 'range' }> {
  const startAt = minDate(new Date(first.startAt), new Date(second.startAt));
  const endAt = maxDate(new Date(first.endAt), new Date(second.endAt));
  return {
    endAt: endAt.toISOString(),
    kind: 'range',
    startAt: startAt.toISOString()
  };
}

function minDate(first: Date, second: Date): Date {
  return first <= second ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first >= second ? first : second;
}

export async function claimNextHistoryJob(
  database: Database,
  options: {
    lockTimeoutMs: number;
    now?: Date | undefined;
  }
): Promise<HistoryJob | null> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - options.lockTimeoutMs);
  const [candidate] = await database
    .select({
      requestId: telegramHistoryReconcilerJobs.requestId
    })
    .from(telegramHistoryReconcilerJobs)
    .where(
      or(
        and(
          inArray(telegramHistoryReconcilerJobs.status, ['queued', 'deferred']),
          lte(telegramHistoryReconcilerJobs.nextRunAt, now)
        ),
        and(
          eq(telegramHistoryReconcilerJobs.status, 'running'),
          lte(telegramHistoryReconcilerJobs.lockedAt, staleBefore)
        )
      )
    )
    .orderBy(
      asc(telegramHistoryReconcilerJobs.nextRunAt),
      asc(telegramHistoryReconcilerJobs.updatedAt)
    )
    .limit(1);

  if (candidate === undefined) {
    return null;
  }

  const [claimed] = await database
    .update(telegramHistoryReconcilerJobs)
    .set({
      lastFailureReason: null,
      lockedAt: now,
      status: 'running',
      updatedAt: sql`now()`
    })
    .where(eq(telegramHistoryReconcilerJobs.requestId, candidate.requestId))
    .returning({
      attemptCount: telegramHistoryReconcilerJobs.attemptCount,
      createdAt: telegramHistoryReconcilerJobs.createdAt,
      lockedAt: telegramHistoryReconcilerJobs.lockedAt,
      nextRunAt: telegramHistoryReconcilerJobs.nextRunAt,
      owner: telegramHistoryReconcilerJobs.owner,
      ownerKind: telegramHistoryReconcilerJobs.ownerKind,
      ownerKey: telegramHistoryReconcilerJobs.ownerKey,
      requestId: telegramHistoryReconcilerJobs.requestId,
      selector: telegramHistoryReconcilerJobs.selector,
      status: telegramHistoryReconcilerJobs.status,
      updatedAt: telegramHistoryReconcilerJobs.updatedAt
    });

  return claimed === undefined ? null : parseJob(claimed);
}

export async function completeHistoryJob(database: Database, requestId: string): Promise<void> {
  await database
    .delete(telegramHistoryReconcilerJobs)
    .where(eq(telegramHistoryReconcilerJobs.requestId, requestId));
}

export async function releaseHistoryJob(
  database: Database,
  requestId: string,
  now = new Date()
): Promise<void> {
  await database
    .update(telegramHistoryReconcilerJobs)
    .set({
      attemptCount: 0,
      lockedAt: null,
      nextRunAt: now,
      status: 'queued',
      updatedAt: sql`now()`
    })
    .where(eq(telegramHistoryReconcilerJobs.requestId, requestId));
}

export async function deferHistoryJob(
  database: Database,
  input: {
    nextRunAt: Date;
    requestId: string;
  }
): Promise<void> {
  await database
    .update(telegramHistoryReconcilerJobs)
    .set({
      attemptCount: sql`${telegramHistoryReconcilerJobs.attemptCount} + 1`,
      lockedAt: null,
      nextRunAt: input.nextRunAt,
      status: 'deferred',
      updatedAt: sql`now()`
    })
    .where(eq(telegramHistoryReconcilerJobs.requestId, input.requestId));
}

export async function failHistoryJob(
  database: Database,
  input: {
    reason: string;
    requestId: string;
  }
): Promise<void> {
  await database
    .update(telegramHistoryReconcilerJobs)
    .set({
      lastFailureReason: input.reason,
      lockedAt: null,
      status: 'failed',
      updatedAt: sql`now()`
    })
    .where(eq(telegramHistoryReconcilerJobs.requestId, input.requestId));
}

export async function readHistoryReconcilerStats(
  database: Database,
  now = new Date()
): Promise<ReconcilerStats> {
  const rows = await database
    .select({
      createdAt: telegramHistoryReconcilerJobs.createdAt,
      ownerKind: telegramHistoryReconcilerJobs.ownerKind,
      status: telegramHistoryReconcilerJobs.status
    })
    .from(telegramHistoryReconcilerJobs);

  const counts = new Map<string, ReconcilerStats['statusCounts'][number]>();
  const oldest = new Map<string, ReconcilerStats['oldestJobAgeSeconds'][number]>();
  for (const row of rows) {
    const status = row.status as JobStatus;
    const key = `${status}:${row.ownerKind}`;
    const count = counts.get(key) ?? {
      count: 0,
      ownerKind: row.ownerKind,
      status
    };
    count.count += 1;
    counts.set(key, count);

    const age = Math.max(0, (now.getTime() - row.createdAt.getTime()) / 1000);
    const current = oldest.get(key);
    if (current === undefined || age > current.value) {
      oldest.set(key, {
        ownerKind: row.ownerKind,
        status,
        value: age
      });
    }
  }

  return {
    oldestJobAgeSeconds: [...oldest.values()],
    statusCounts: [...counts.values()]
  };
}

export async function readNextHistoryJobRunAt(
  database: Database,
  options: {
    lockTimeoutMs: number;
  }
): Promise<Date | undefined> {
  const rows = await database
    .select({
      lockedAt: telegramHistoryReconcilerJobs.lockedAt,
      nextRunAt: telegramHistoryReconcilerJobs.nextRunAt,
      status: telegramHistoryReconcilerJobs.status
    })
    .from(telegramHistoryReconcilerJobs)
    .where(inArray(telegramHistoryReconcilerJobs.status, ['queued', 'deferred', 'running']));

  return earliestDate(
    rows
      .map((row) =>
        row.status === 'running' ? staleRunAt(row.lockedAt, options.lockTimeoutMs) : row.nextRunAt
      )
      .filter((value): value is Date => value instanceof Date)
  );
}

function staleRunAt(lockedAt: Date | null, lockTimeoutMs: number): Date | undefined {
  return lockedAt === null ? undefined : new Date(lockedAt.getTime() + lockTimeoutMs);
}

function earliestDate(values: Date[]): Date | undefined {
  const [first, ...rest] = values;
  return first === undefined
    ? undefined
    : rest.reduce((earliest, value) => (value < earliest ? value : earliest), first);
}

function parseJob(row: {
  attemptCount: number;
  createdAt: Date;
  lockedAt: Date | null;
  nextRunAt: Date;
  owner: JsonValue;
  ownerKind: string;
  ownerKey: string;
  requestId: string;
  selector: JsonValue;
  status: string;
  updatedAt: Date;
}): HistoryJob {
  const input = messageReadRequestSchema.parse({
    owner: row.owner,
    selector: row.selector
  });
  return {
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    lockedAt: row.lockedAt,
    nextRunAt: row.nextRunAt,
    owner: input.owner,
    ownerKind: row.ownerKind,
    ownerKey: row.ownerKey,
    requestId: row.requestId,
    selector: input.selector,
    status: row.status as JobStatus,
    updatedAt: row.updatedAt
  };
}
