import type { AppDatabase } from '@agentg/database/client';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';

import type { HistorySyncController } from './controller.js';
import {
  deleteManualHistoryTargetFromCommand,
  upsertManualHistoryTargetFromCommand
} from './target-commands.js';

export function subscribeHistorySyncCommands(options: {
  controller: HistorySyncController;
  database: AppDatabase;
  eventBus: EventBus;
}): EventSubscription[] {
  const historySyncSubscription = options.eventBus.subscribe('history.sync.requested', (event) => {
    const data = asRecord(event.data);
    const reason = typeof data?.reason === 'string' ? data.reason : 'requested';
    options.controller.request(reason);
  });

  const historyTargetSubscription = options.eventBus.respond(
    'history.target.upsert.requested',
    async (event) => handleHistoryTargetUpsertCommand(options, event)
  );

  const historyTargetDeleteSubscription = options.eventBus.respond(
    'history.target.delete.requested',
    async (event) => handleHistoryTargetDeleteCommand(options, event)
  );

  return [historySyncSubscription, historyTargetSubscription, historyTargetDeleteSubscription];
}

async function handleHistoryTargetUpsertCommand(
  options: {
    controller: HistorySyncController;
    database: AppDatabase;
    eventBus: EventBus;
  },
  event: IntegrationEvent
): Promise<IntegrationEvent> {
  const data = asRecord(event.data);
  const command = data?.command ?? event.data;
  try {
    const target = await upsertManualHistoryTargetFromCommand(options.database, command);
    const upserted = createIntegrationEvent({
      data: {
        target
      },
      source: 'telegram.history-sync',
      type: 'history.target.upserted'
    });
    options.eventBus.publish(upserted);
    options.controller.request('target-upserted');

    return createIntegrationEvent({
      data: {
        target
      },
      source: 'telegram.history-sync',
      type: 'history.target.upsert.completed'
    });
  } catch (error) {
    const failed = createIntegrationEvent({
      data: {
        error: error instanceof Error ? error.message : String(error)
      },
      source: 'telegram.history-sync',
      type: 'history.target.upsert.failed'
    });
    options.eventBus.publish(failed);
    return failed;
  }
}

async function handleHistoryTargetDeleteCommand(
  options: {
    controller: HistorySyncController;
    database: AppDatabase;
    eventBus: EventBus;
  },
  event: IntegrationEvent
): Promise<IntegrationEvent> {
  const data = asRecord(event.data);
  const command = data?.command ?? event.data;
  try {
    const target = await deleteManualHistoryTargetFromCommand(options.database, command);
    const deleted = createIntegrationEvent({
      data: {
        target
      },
      source: 'telegram.history-sync',
      type: 'history.target.deleted'
    });
    options.eventBus.publish(deleted);
    options.controller.request('target-deleted');

    return createIntegrationEvent({
      data: {
        target
      },
      source: 'telegram.history-sync',
      type: 'history.target.delete.completed'
    });
  } catch (error) {
    const failed = createIntegrationEvent({
      data: {
        error: error instanceof Error ? error.message : String(error)
      },
      source: 'telegram.history-sync',
      type: 'history.target.delete.failed'
    });
    options.eventBus.publish(failed);
    return failed;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
