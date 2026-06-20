import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { OccurrenceStatus } from '../schema.js';
import type { RegistrationOwner, TriggerAction, TriggerCondition } from '../registrations/types.js';

export const triggerRegistrations = pgTable(
  'triggers_registrations',
  {
    action: jsonb('action').$type<TriggerAction>().notNull(),
    anchorAt: timestamp('anchor_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    key: text('key').primaryKey(),
    name: text('name').notNull(),
    owner: jsonb('owner').$type<RegistrationOwner>().notNull(),
    ownerKey: text('owner_key').notNull(),
    ownerModule: text('owner_module').notNull(),
    schedule: jsonb('schedule').$type<TriggerCondition>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('triggers_registrations_owner_idx').on(table.ownerModule, table.ownerKey)]
);

export const triggerOccurrences = pgTable(
  'triggers_occurrences',
  {
    action: jsonb('action').$type<TriggerAction>().notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    key: text('key').primaryKey(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    leaseOwner: text('lease_owner'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull(),
    providerRunId: text('provider_run_id'),
    registrationName: text('registration_name').notNull(),
    registrationKey: text('registration_key').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: text('status').$type<OccurrenceStatus>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('triggers_occurrences_due_idx').on(table.status, table.nextAttemptAt),
    index('triggers_occurrences_registration_idx').on(table.registrationKey, table.scheduledAt)
  ]
);
