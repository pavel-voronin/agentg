import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { triggerOccurrences, triggerRegistrations } from './database/schema.js';
import type { Database } from './database/client.js';
import { occurrenceKey, type TriggerOccurrence } from './occurrences/types.js';
import {
  registrationFromInput,
  registrationKey,
  type RegistrationOwner,
  type TriggerRegistration,
  type TriggerRegistrationInput
} from './registrations/types.js';
import type { ListOccurrencesInput, ListRegistrationsInput, OccurrenceStatus } from './schema.js';

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
  listRegistrations(input?: ListRegistrationsInput): Promise<readonly TriggerRegistration[]>;
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
    owner: RegistrationOwner;
    registrations: readonly TriggerRegistrationInput[];
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

type StoreDatabase = Pick<Database, 'delete' | 'insert' | 'select' | 'update'>;
const claimableOccurrenceStatuses = [
  'scheduled',
  'claimed',
  'dispatching',
  'retryWaiting'
] as const;

export function createPostgresTriggerStore(database: Database): TriggerStore {
  const store: TriggerStore = {
    async claimDue(input) {
      const rows = await database
        .select()
        .from(triggerOccurrences)
        .where(
          and(
            inArray(triggerOccurrences.status, claimableOccurrenceStatuses),
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
              inArray(triggerOccurrences.status, claimableOccurrenceStatuses),
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
        registrationName: registration.name,
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
    async listRegistrations(input = {}) {
      return listRegistrationsFromDatabase(database, input);
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
      return database.transaction((transaction) =>
        replaceRegistrationsInDatabase(transaction, input)
      );
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

async function replaceRegistrationsInDatabase(
  database: StoreDatabase,
  input: {
    now: Date;
    owner: RegistrationOwner;
    registrations: readonly TriggerRegistrationInput[];
  }
): Promise<readonly TriggerRegistration[]> {
  const current = new Map(
    (await listRegistrationsFromDatabase(database, { owner: input.owner })).map((item) => [
      item.key,
      item
    ])
  );
  const activeKeys: string[] = [];
  for (const item of input.registrations) {
    const key = registrationKey({ name: item.name, owner: input.owner });
    activeKeys.push(key);
    const existing = current.get(key);
    const configuredStart =
      item.condition.startAt === undefined ? undefined : new Date(item.condition.startAt);
    const registration = registrationFromInput(
      item,
      input.owner,
      configuredStart ?? existing?.anchorAt ?? input.now
    );
    await database
      .insert(triggerRegistrations)
      .values({
        action: registration.action,
        anchorAt: registration.anchorAt,
        key: registration.key,
        name: registration.name,
        owner: registration.owner,
        ownerKey: registration.owner.key,
        ownerModule: registration.owner.module,
        schedule: registration.schedule,
        updatedAt: input.now
      })
      .onConflictDoUpdate({
        set: {
          action: registration.action,
          anchorAt: registration.anchorAt,
          name: registration.name,
          owner: registration.owner,
          ownerKey: registration.owner.key,
          ownerModule: registration.owner.module,
          schedule: registration.schedule,
          updatedAt: input.now
        },
        target: triggerRegistrations.key
      });
  }

  const removedKeys = [...current.keys()].filter((key) => !activeKeys.includes(key));
  if (removedKeys.length > 0) {
    await database
      .delete(triggerRegistrations)
      .where(inArray(triggerRegistrations.key, removedKeys));
    await cancelRemovedOccurrences(database, input.now, removedKeys);
  }

  return listRegistrationsFromDatabase(database, { owner: input.owner });
}

export function createMemoryTriggerStore(): TriggerStore {
  const registrations = new Map<string, TriggerRegistration>();
  const occurrences = new Map<string, TriggerOccurrence>();

  const store: TriggerStore = {
    claimDue(input) {
      const claimed: TriggerOccurrence[] = [];
      const due = [...occurrences.values()]
        .filter((item) => isDueOccurrence(item, input.now))
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
          registrationName: registration.name,
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
    listRegistrations(input = {}) {
      return Promise.resolve(
        [...registrations.values()]
          .filter(
            (item) =>
              input.owner === undefined ||
              (item.owner.module === input.owner.module &&
                (input.owner.key === undefined || item.owner.key === input.owner.key))
          )
          .sort((left, right) => left.key.localeCompare(right.key))
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
      const activeKeys = new Set(
        input.registrations.map((item) => registrationKey({ name: item.name, owner: input.owner }))
      );
      for (const item of input.registrations) {
        const key = registrationKey({ name: item.name, owner: input.owner });
        const existing = registrations.get(key);
        const configuredStart =
          item.condition.startAt === undefined ? undefined : new Date(item.condition.startAt);
        registrations.set(
          key,
          registrationFromInput(
            item,
            input.owner,
            configuredStart ?? existing?.anchorAt ?? input.now
          )
        );
      }
      const removedKeys: string[] = [];
      for (const [key, registration] of registrations) {
        if (
          registration.owner.module === input.owner.module &&
          registration.owner.key === input.owner.key &&
          !activeKeys.has(key)
        ) {
          registrations.delete(key);
          removedKeys.push(key);
        }
      }
      for (const occurrence of occurrences.values()) {
        if (
          removedKeys.includes(occurrence.registrationKey) &&
          (occurrence.status === 'scheduled' || occurrence.status === 'retryWaiting')
        ) {
          occurrences.set(occurrence.key, {
            ...occurrence,
            status: 'cancelled'
          });
        }
      }
      return store.listRegistrations({ owner: input.owner });
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

async function listRegistrationsFromDatabase(
  database: StoreDatabase,
  input: ListRegistrationsInput
): Promise<readonly TriggerRegistration[]> {
  const rows = await database
    .select()
    .from(triggerRegistrations)
    .where(
      input.owner === undefined
        ? undefined
        : and(
            eq(triggerRegistrations.ownerModule, input.owner.module),
            input.owner.key === undefined
              ? undefined
              : eq(triggerRegistrations.ownerKey, input.owner.key)
          )
    )
    .orderBy(triggerRegistrations.key);
  return rows.map(toRegistration);
}

function dueOccurrenceCondition(now: Date) {
  return and(
    inArray(triggerOccurrences.status, claimableOccurrenceStatuses),
    lte(triggerOccurrences.nextAttemptAt, now),
    or(isNull(triggerOccurrences.leaseExpiresAt), lte(triggerOccurrences.leaseExpiresAt, now))
  );
}

function isDueOccurrence(occurrence: TriggerOccurrence, now: Date): boolean {
  return (
    (occurrence.status === 'scheduled' ||
      occurrence.status === 'claimed' ||
      occurrence.status === 'dispatching' ||
      occurrence.status === 'retryWaiting') &&
    occurrence.nextAttemptAt <= now &&
    (occurrence.leaseExpiresAt === undefined || occurrence.leaseExpiresAt <= now)
  );
}

function secondsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

async function cancelRemovedOccurrences(
  database: StoreDatabase,
  now: Date,
  removedKeys: readonly string[]
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
        inArray(triggerOccurrences.registrationKey, [...removedKeys])
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
    name: row.name,
    owner: row.owner,
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
    registrationName: row.registrationName,
    scheduledAt: row.scheduledAt,
    status: row.status
  };
}

function compareOccurrences(left: TriggerOccurrence, right: TriggerOccurrence): number {
  return (
    left.scheduledAt.getTime() - right.scheduledAt.getTime() || left.key.localeCompare(right.key)
  );
}
