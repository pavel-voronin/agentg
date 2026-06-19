import { and, eq, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm';

import type { TriggerRule } from '../policies/policies.js';
import { triggerOccurrences, triggerRegistrations } from './database/schema.js';
import type { Database } from './database/client.js';
import { occurrenceKey, type TriggerOccurrence } from './occurrences/types.js';
import {
  registrationFromRule,
  registrationKey,
  type TriggerRegistration
} from './registrations/types.js';
import type { ListOccurrencesInput, OccurrenceStatus } from './schema.js';

export type TriggerStore = {
  claimDue(input: {
    leaseOwner: string;
    leaseSeconds: number;
    limit: number;
    now: Date;
  }): Promise<readonly TriggerOccurrence[]>;
  createOccurrences(input: {
    now: Date;
    registrations: readonly {
      registration: TriggerRegistration;
      scheduledAt: Date;
    }[];
  }): Promise<readonly TriggerOccurrence[]>;
  listOccurrences(input?: ListOccurrencesInput): Promise<readonly TriggerOccurrence[]>;
  listRegistrations(): Promise<readonly TriggerRegistration[]>;
  markAccepted(input: { key: string; now: Date; providerRunId: string }): Promise<void>;
  markDispatching(input: { key: string; now: Date }): Promise<void>;
  markFailed(input: { code: string; key: string; message: string; now: Date }): Promise<void>;
  markRejected(input: { code: string; key: string; message: string; now: Date }): Promise<void>;
  markRetryWaiting(input: {
    code: string;
    key: string;
    message: string;
    nextAttemptAt: Date;
    now: Date;
  }): Promise<void>;
  replaceRegistrations(input: {
    now: Date;
    rules: readonly TriggerRule[];
  }): Promise<readonly TriggerRegistration[]>;
  readStats(input: { now: Date }): Promise<TriggerStats>;
};

export type TriggerStats = {
  dueOccurrenceCount: number;
  occurrenceStatusCounts: readonly {
    count: number;
    status: OccurrenceStatus;
  }[];
  oldestDueOccurrenceAgeSeconds: number;
  registrationCount: number;
};

export function createPostgresTriggerStore(database: Database): TriggerStore {
  const store: TriggerStore = {
    async claimDue(input) {
      const rows = await database
        .select()
        .from(triggerOccurrences)
        .where(
          and(
            inArray(triggerOccurrences.status, ['scheduled', 'claimed', 'retryWaiting']),
            lte(triggerOccurrences.nextAttemptAt, input.now),
            or(
              isNull(triggerOccurrences.leaseExpiresAt),
              lte(triggerOccurrences.leaseExpiresAt, input.now)
            )
          )
        )
        .orderBy(triggerOccurrences.scheduledAt, triggerOccurrences.key)
        .limit(input.limit);

      const claimed: TriggerOccurrence[] = [];
      for (const row of rows) {
        const [updated] = await database
          .update(triggerOccurrences)
          .set({
            leaseExpiresAt: new Date(input.now.getTime() + input.leaseSeconds * 1000),
            leaseOwner: input.leaseOwner,
            status: 'claimed',
            updatedAt: input.now
          })
          .where(
            and(
              eq(triggerOccurrences.key, row.key),
              inArray(triggerOccurrences.status, ['scheduled', 'claimed', 'retryWaiting']),
              or(
                isNull(triggerOccurrences.leaseExpiresAt),
                lte(triggerOccurrences.leaseExpiresAt, input.now)
              )
            )
          )
          .returning();
        if (updated !== undefined) {
          claimed.push(toOccurrence(updated));
        }
      }
      return Promise.resolve(claimed);
    },
    async createOccurrences(input) {
      const rows = input.registrations.map(({ registration, scheduledAt }) => ({
        action: registration.action,
        key: occurrenceKey({ registrationKey: registration.key, scheduledAt }),
        nextAttemptAt: scheduledAt,
        registrationKey: registration.key,
        ruleName: registration.rule.name,
        scheduledAt,
        status: 'scheduled' as const
      }));
      if (rows.length === 0) {
        return [];
      }
      const inserted = await database
        .insert(triggerOccurrences)
        .values(rows)
        .onConflictDoNothing()
        .returning();
      return inserted.map(toOccurrence);
    },
    async listOccurrences(input = {}) {
      const rows = await database
        .select()
        .from(triggerOccurrences)
        .where(
          and(
            input.registrationKey === undefined
              ? undefined
              : eq(triggerOccurrences.registrationKey, input.registrationKey),
            input.status === undefined ? undefined : eq(triggerOccurrences.status, input.status)
          )
        )
        .orderBy(triggerOccurrences.scheduledAt, triggerOccurrences.key);
      return rows.map(toOccurrence);
    },
    async listRegistrations() {
      const rows = await database
        .select()
        .from(triggerRegistrations)
        .orderBy(triggerRegistrations.key);
      return rows.map(toRegistration);
    },
    markAccepted(input) {
      return updateTerminal(database, {
        key: input.key,
        now: input.now,
        providerRunId: input.providerRunId,
        status: 'accepted'
      });
    },
    async markDispatching(input) {
      await database
        .update(triggerOccurrences)
        .set({
          attemptCount: sql`${triggerOccurrences.attemptCount} + 1`,
          status: 'dispatching',
          updatedAt: input.now
        })
        .where(eq(triggerOccurrences.key, input.key));
    },
    markFailed(input) {
      return updateTerminal(database, {
        code: input.code,
        key: input.key,
        message: input.message,
        now: input.now,
        status: 'failed'
      });
    },
    markRejected(input) {
      return updateTerminal(database, {
        code: input.code,
        key: input.key,
        message: input.message,
        now: input.now,
        status: 'rejected'
      });
    },
    async markRetryWaiting(input) {
      await database
        .update(triggerOccurrences)
        .set({
          failureCode: input.code,
          failureMessage: input.message,
          leaseExpiresAt: null,
          leaseOwner: null,
          nextAttemptAt: input.nextAttemptAt,
          status: 'retryWaiting',
          updatedAt: input.now
        })
        .where(eq(triggerOccurrences.key, input.key));
    },
    async replaceRegistrations(input) {
      const current = new Map((await store.listRegistrations()).map((item) => [item.key, item]));
      const activeKeys: string[] = [];
      for (const rule of input.rules) {
        const key = registrationKey(rule);
        activeKeys.push(key);
        const existing = current.get(key);
        const configuredStart =
          rule.spec.condition.startAt === undefined
            ? undefined
            : new Date(rule.spec.condition.startAt);
        const registration = registrationFromRule(
          rule,
          configuredStart ?? existing?.anchorAt ?? input.now
        );
        await database
          .insert(triggerRegistrations)
          .values({
            action: registration.action,
            anchorAt: registration.anchorAt,
            key: registration.key,
            ruleKind: registration.rule.kind,
            ruleName: registration.rule.name,
            schedule: registration.schedule,
            updatedAt: input.now
          })
          .onConflictDoUpdate({
            set: {
              action: registration.action,
              anchorAt: registration.anchorAt,
              ruleKind: registration.rule.kind,
              ruleName: registration.rule.name,
              schedule: registration.schedule,
              updatedAt: input.now
            },
            target: triggerRegistrations.key
          });
      }

      if (activeKeys.length === 0) {
        await database.delete(triggerRegistrations);
        await cancelInactiveOccurrences(database, input.now);
      } else {
        await database
          .delete(triggerRegistrations)
          .where(notInArray(triggerRegistrations.key, activeKeys));
        await cancelInactiveOccurrences(database, input.now, activeKeys);
      }

      return store.listRegistrations();
    },
    async readStats(input) {
      const [registrationRow] = await database
        .select({
          count: sql<number>`count(*)::int`
        })
        .from(triggerRegistrations);
      const statusRows = await database
        .select({
          count: sql<number>`count(*)::int`,
          status: triggerOccurrences.status
        })
        .from(triggerOccurrences)
        .groupBy(triggerOccurrences.status);
      const dueWhere = dueOccurrenceCondition(input.now);
      const [dueRow] = await database
        .select({
          count: sql<number>`count(*)::int`
        })
        .from(triggerOccurrences)
        .where(dueWhere);
      const [oldestDue] = await database
        .select({
          nextAttemptAt: triggerOccurrences.nextAttemptAt
        })
        .from(triggerOccurrences)
        .where(dueWhere)
        .orderBy(triggerOccurrences.nextAttemptAt, triggerOccurrences.key)
        .limit(1);

      return {
        dueOccurrenceCount: dueRow?.count ?? 0,
        occurrenceStatusCounts: statusRows.map((row) => ({
          count: row.count,
          status: row.status
        })),
        oldestDueOccurrenceAgeSeconds:
          oldestDue === undefined ? 0 : secondsBetween(oldestDue.nextAttemptAt, input.now),
        registrationCount: registrationRow?.count ?? 0
      };
    }
  };

  return store;
}

export function createMemoryTriggerStore(): TriggerStore {
  const registrations = new Map<string, TriggerRegistration>();
  const occurrences = new Map<string, TriggerOccurrence>();

  const store: TriggerStore = {
    claimDue(input) {
      const claimed: TriggerOccurrence[] = [];
      const due = [...occurrences.values()]
        .filter(
          (item) =>
            (item.status === 'scheduled' ||
              item.status === 'claimed' ||
              item.status === 'retryWaiting') &&
            item.nextAttemptAt <= input.now &&
            (item.leaseExpiresAt === undefined || item.leaseExpiresAt <= input.now)
        )
        .sort(compareOccurrences)
        .slice(0, input.limit);
      for (const occurrence of due) {
        const next = {
          ...occurrence,
          leaseExpiresAt: new Date(input.now.getTime() + input.leaseSeconds * 1000),
          leaseOwner: input.leaseOwner,
          status: 'claimed' as const
        };
        occurrences.set(next.key, next);
        claimed.push(next);
      }
      return Promise.resolve(claimed);
    },
    async createOccurrences(input) {
      const output: TriggerOccurrence[] = [];
      for (const { registration, scheduledAt } of input.registrations) {
        const key = occurrenceKey({ registrationKey: registration.key, scheduledAt });
        if (occurrences.has(key)) {
          continue;
        }
        const occurrence = {
          action: registration.action,
          attemptCount: 0,
          key,
          nextAttemptAt: scheduledAt,
          registrationKey: registration.key,
          ruleName: registration.rule.name,
          scheduledAt,
          status: 'scheduled'
        } satisfies TriggerOccurrence;
        occurrences.set(key, occurrence);
        output.push(occurrence);
      }
      return Promise.resolve(output);
    },
    listOccurrences(input = {}) {
      return Promise.resolve(
        [...occurrences.values()]
          .filter(
            (item) =>
              (input.registrationKey === undefined ||
                item.registrationKey === input.registrationKey) &&
              (input.status === undefined || item.status === input.status)
          )
          .sort(compareOccurrences)
      );
    },
    listRegistrations() {
      return Promise.resolve(
        [...registrations.values()].sort((left, right) => left.key.localeCompare(right.key))
      );
    },
    markAccepted(input) {
      updateMemoryOccurrence(input.key, {
        providerRunId: input.providerRunId,
        status: 'accepted'
      });
      return Promise.resolve();
    },
    markDispatching(input) {
      const occurrence = requiredMemoryOccurrence(input.key);
      occurrences.set(input.key, {
        ...occurrence,
        attemptCount: occurrence.attemptCount + 1,
        status: 'dispatching'
      });
      return Promise.resolve();
    },
    markFailed(input) {
      updateMemoryOccurrence(input.key, {
        failureCode: input.code,
        failureMessage: input.message,
        status: 'failed'
      });
      return Promise.resolve();
    },
    markRejected(input) {
      updateMemoryOccurrence(input.key, {
        failureCode: input.code,
        failureMessage: input.message,
        status: 'rejected'
      });
      return Promise.resolve();
    },
    markRetryWaiting(input) {
      updateMemoryOccurrence(input.key, {
        failureCode: input.code,
        failureMessage: input.message,
        leaseExpiresAt: undefined,
        leaseOwner: undefined,
        nextAttemptAt: input.nextAttemptAt,
        status: 'retryWaiting'
      });
      return Promise.resolve();
    },
    replaceRegistrations(input) {
      const activeKeys = new Set(input.rules.map(registrationKey));
      for (const rule of input.rules) {
        const key = registrationKey(rule);
        const existing = registrations.get(key);
        const configuredStart =
          rule.spec.condition.startAt === undefined
            ? undefined
            : new Date(rule.spec.condition.startAt);
        registrations.set(
          key,
          registrationFromRule(rule, configuredStart ?? existing?.anchorAt ?? input.now)
        );
      }
      for (const key of registrations.keys()) {
        if (!activeKeys.has(key)) {
          registrations.delete(key);
        }
      }
      for (const occurrence of occurrences.values()) {
        if (
          !activeKeys.has(occurrence.registrationKey) &&
          (occurrence.status === 'scheduled' || occurrence.status === 'retryWaiting')
        ) {
          occurrences.set(occurrence.key, {
            ...occurrence,
            status: 'cancelled'
          });
        }
      }
      return store.listRegistrations();
    },
    readStats(input) {
      const statusCounts = new Map<OccurrenceStatus, number>();
      let dueOccurrenceCount = 0;
      let oldestDue: Date | undefined;
      for (const occurrence of occurrences.values()) {
        statusCounts.set(occurrence.status, (statusCounts.get(occurrence.status) ?? 0) + 1);
        if (isDueOccurrence(occurrence, input.now)) {
          dueOccurrenceCount += 1;
          if (oldestDue === undefined || occurrence.nextAttemptAt < oldestDue) {
            oldestDue = occurrence.nextAttemptAt;
          }
        }
      }

      return Promise.resolve({
        dueOccurrenceCount,
        occurrenceStatusCounts: [...statusCounts.entries()].map(([status, count]) => ({
          count,
          status
        })),
        oldestDueOccurrenceAgeSeconds:
          oldestDue === undefined ? 0 : secondsBetween(oldestDue, input.now),
        registrationCount: registrations.size
      });
    }
  };

  return store;

  function requiredMemoryOccurrence(key: string): TriggerOccurrence {
    const occurrence = occurrences.get(key);
    if (occurrence === undefined) {
      throw new Error(`Trigger occurrence is not found: ${key}`);
    }
    return occurrence;
  }

  function updateMemoryOccurrence(key: string, patch: Partial<TriggerOccurrence>): void {
    occurrences.set(key, {
      ...requiredMemoryOccurrence(key),
      ...patch
    });
  }
}

function dueOccurrenceCondition(now: Date) {
  return and(
    inArray(triggerOccurrences.status, ['scheduled', 'claimed', 'retryWaiting']),
    lte(triggerOccurrences.nextAttemptAt, now),
    or(isNull(triggerOccurrences.leaseExpiresAt), lte(triggerOccurrences.leaseExpiresAt, now))
  );
}

function isDueOccurrence(occurrence: TriggerOccurrence, now: Date): boolean {
  return (
    (occurrence.status === 'scheduled' ||
      occurrence.status === 'claimed' ||
      occurrence.status === 'retryWaiting') &&
    occurrence.nextAttemptAt <= now &&
    (occurrence.leaseExpiresAt === undefined || occurrence.leaseExpiresAt <= now)
  );
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

async function cancelInactiveOccurrences(
  database: Database,
  now: Date,
  activeKeys?: readonly string[]
): Promise<void> {
  await database
    .update(triggerOccurrences)
    .set({
      status: 'cancelled',
      updatedAt: now
    })
    .where(
      and(
        inArray(triggerOccurrences.status, ['scheduled', 'retryWaiting']),
        activeKeys === undefined
          ? undefined
          : notInArray(triggerOccurrences.registrationKey, [...activeKeys])
      )
    );
}

async function updateTerminal(
  database: Database,
  input: {
    code?: string | undefined;
    key: string;
    message?: string | undefined;
    now: Date;
    providerRunId?: string | undefined;
    status: Extract<OccurrenceStatus, 'accepted' | 'failed' | 'rejected'>;
  }
): Promise<void> {
  await database
    .update(triggerOccurrences)
    .set({
      failureCode: input.code ?? null,
      failureMessage: input.message ?? null,
      leaseExpiresAt: null,
      leaseOwner: null,
      providerRunId: input.providerRunId ?? null,
      status: input.status,
      updatedAt: input.now
    })
    .where(eq(triggerOccurrences.key, input.key));
}

function toRegistration(row: typeof triggerRegistrations.$inferSelect): TriggerRegistration {
  return {
    action: row.action,
    anchorAt: row.anchorAt,
    key: row.key,
    rule: {
      kind: 'TriggerRule',
      name: row.ruleName
    },
    schedule: row.schedule
  };
}

function toOccurrence(row: typeof triggerOccurrences.$inferSelect): TriggerOccurrence {
  return {
    action: row.action,
    attemptCount: row.attemptCount,
    ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
    ...(row.failureMessage === null ? {} : { failureMessage: row.failureMessage }),
    key: row.key,
    ...(row.leaseExpiresAt === null ? {} : { leaseExpiresAt: row.leaseExpiresAt }),
    ...(row.leaseOwner === null ? {} : { leaseOwner: row.leaseOwner }),
    nextAttemptAt: row.nextAttemptAt,
    ...(row.providerRunId === null ? {} : { providerRunId: row.providerRunId }),
    registrationKey: row.registrationKey,
    ruleName: row.ruleName,
    scheduledAt: row.scheduledAt,
    status: row.status
  };
}

function compareOccurrences(left: TriggerOccurrence, right: TriggerOccurrence): number {
  return (
    left.scheduledAt.getTime() - right.scheduledAt.getTime() || left.key.localeCompare(right.key)
  );
}
