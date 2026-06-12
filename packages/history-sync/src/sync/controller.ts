import { createLogger, logError, timeTelemetrySpan, type EventBus } from '@agentg/framework';

import {
  runHistorySync,
  type SyncOptions,
  type SyncRunRequest,
  type SyncTargetScope
} from './executor.js';
import type { Database } from '../database/client.js';
import type { HistorySyncTarget, TelegramHistoryClient } from '../model/types.js';

export type Controller = {
  request(reason: string): void;
  stop(): void;
  wait(): Promise<void>;
};

type ControllerObserver = {
  targetsChanged(targets: readonly HistorySyncTarget[]): void;
};

const RETRY_DELAY_MS = 5000;
const METRIC_CONTROLLER_PASS_DURATION = 'history_sync.controller.pass.duration';
const logger = createLogger('history-sync');

export function createController(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  options: SyncOptions,
  observer?: ControllerObserver
): Controller {
  let currentTask: Promise<void> | undefined;
  let pendingRequest: SyncRunRequest | undefined;
  let stopped = false;
  let wakeRetryDelay: (() => void) | undefined;

  const request = (reason: string): void => {
    if (stopped) {
      return;
    }

    pendingRequest = mergeRequests(pendingRequest, requestFromReason(reason));
    currentTask ??= runLoop(reason).finally(() => {
      currentTask = undefined;
    });
  };

  async function runLoop(initialReason: string): Promise<void> {
    void initialReason;
    while (pendingRequest !== undefined && !stopped) {
      const currentRequest = pendingRequest;
      pendingRequest = undefined;
      try {
        events.publish('history-sync.sync.accepted', {
          mode: controllerMode(currentRequest),
          reason: currentRequest.reason
        });
        const summary = await timeControllerPass(currentRequest.reason, () =>
          runHistorySync(database, telegram, events, currentRequest, options)
        );
        observer?.targetsChanged(summary.targets);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            event: 'history-sync.failed_pass',
            ...logError(error)
          },
          'history sync pass failed'
        );
        events.publish('history-sync.sync.failed', {
          error: message,
          mode: controllerMode(currentRequest),
          reason: currentRequest.reason
        });
        if (await delayUnlessStopped(RETRY_DELAY_MS)) {
          pendingRequest = mergeRequests(pendingRequest, retryRequest(currentRequest));
        }
      }
    }
  }

  async function delayUnlessStopped(milliseconds: number): Promise<boolean> {
    if (milliseconds <= 0 || stopped) {
      return false;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, milliseconds);
      wakeRetryDelay = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
    wakeRetryDelay = undefined;
    return !stopped;
  }

  return {
    request,
    stop() {
      stopped = true;
      pendingRequest = undefined;
      wakeRetryDelay?.();
    },
    async wait() {
      await currentTask;
    }
  };
}

function requestFromReason(reason: string): SyncRunRequest {
  const manualChatId = reasonValue(reason, 'manual:');
  if (manualChatId !== undefined) {
    return targetSelectedRequest('manual', manualChatId);
  }

  const discoveredChatId = reasonValue(reason, 'chat-discovered:');
  if (discoveredChatId !== undefined) {
    return {
      discoveredChatIds: new Set([discoveredChatId]),
      discoverChats: false,
      fullReconcile: false,
      reason: 'chat-discovered',
      targetScope: 'selected',
      targetChatIds: new Set([discoveredChatId])
    };
  }

  const upsertedChatId = reasonValue(reason, 'target-upserted:');
  if (upsertedChatId !== undefined) {
    return targetSelectedRequest('target-upserted', upsertedChatId);
  }

  const deletedChatId = reasonValue(reason, 'target-deleted:');
  if (deletedChatId !== undefined) {
    return targetSelectedRequest('target-deleted', deletedChatId);
  }

  if (reason === 'startup') {
    return fullRequest('startup', true);
  }
  if (reason === 'manual' || reason === 'full-reconcile') {
    return fullRequest(reason, false);
  }
  if (
    reason === 'relative-targets' ||
    reason === 'target-upserted' ||
    reason === 'target-deleted'
  ) {
    return {
      discoveredChatIds: new Set(),
      discoverChats: false,
      fullReconcile: false,
      reason,
      targetScope: reason === 'relative-targets' ? 'relative' : 'all'
    };
  }

  return {
    discoveredChatIds: new Set(),
    discoverChats: false,
    fullReconcile: false,
    reason: reasonCategory(reason),
    targetScope: 'all'
  };
}

function fullRequest(reason: string, discoverChats: boolean): SyncRunRequest {
  return {
    discoveredChatIds: new Set(),
    discoverChats,
    fullReconcile: true,
    reason,
    targetScope: 'all'
  };
}

function targetSelectedRequest(reason: string, chatId: string): SyncRunRequest {
  return {
    discoveredChatIds: new Set(),
    discoverChats: false,
    fullReconcile: false,
    reason,
    targetScope: 'selected',
    targetChatIds: new Set([chatId])
  };
}

function retryRequest(request: SyncRunRequest): SyncRunRequest {
  return {
    ...request,
    discoveredChatIds: new Set(request.discoveredChatIds),
    reason: 'retry',
    ...(request.targetChatIds === undefined
      ? {}
      : { targetChatIds: new Set(request.targetChatIds) })
  };
}

function mergeRequests(current: SyncRunRequest | undefined, next: SyncRunRequest): SyncRunRequest {
  if (current === undefined) {
    return cloneRequest(next);
  }

  const reason = current.reason === next.reason ? current.reason : 'queued';
  if (current.fullReconcile || next.fullReconcile) {
    return {
      discoveredChatIds: new Set(),
      discoverChats: current.discoverChats || next.discoverChats,
      fullReconcile: true,
      reason,
      targetScope: 'all'
    };
  }

  return {
    discoveredChatIds: new Set([...current.discoveredChatIds, ...next.discoveredChatIds]),
    discoverChats: false,
    fullReconcile: false,
    reason,
    targetScope: mergeTargetScopes(current.targetScope, next.targetScope),
    ...mergedTargetChatIds(current.targetChatIds, next.targetChatIds)
  };
}

function cloneRequest(request: SyncRunRequest): SyncRunRequest {
  return {
    ...request,
    discoveredChatIds: new Set(request.discoveredChatIds),
    ...(request.targetChatIds === undefined
      ? {}
      : { targetChatIds: new Set(request.targetChatIds) })
  };
}

function mergedTargetChatIds(
  first: ReadonlySet<string> | undefined,
  second: ReadonlySet<string> | undefined
): Pick<SyncRunRequest, 'targetChatIds'> {
  const targetChatIds = new Set([...(first ?? []), ...(second ?? [])]);
  if (targetChatIds.size === 0) {
    return {};
  }
  return {
    targetChatIds
  };
}

function controllerMode(request: SyncRunRequest): string {
  if (request.fullReconcile) {
    return request.discoverChats ? 'startup_full' : 'full_reconcile';
  }
  if (request.discoveredChatIds.size > 0) {
    return 'chat_discovered';
  }
  if (request.targetScope === 'relative') {
    return 'target_relative';
  }
  if (request.targetScope === 'all') {
    return 'target_all';
  }
  if (request.targetScope === 'relative_and_selected') {
    return 'target_mixed';
  }
  return 'target_selected';
}

function mergeTargetScopes(first: SyncTargetScope, second: SyncTargetScope): SyncTargetScope {
  if (first === 'all' || second === 'all') {
    return 'all';
  }
  if (first === second) {
    return first;
  }
  return 'relative_and_selected';
}

function reasonValue(reason: string, prefix: string): string | undefined {
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : undefined;
}

function timeControllerPass<T>(reason: string, operation: () => Promise<T>): Promise<T> {
  const attributes = {
    'history_sync.controller.reason': reasonCategory(reason)
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_CONTROLLER_PASS_DURATION
      },
      name: 'history_sync.controller.pass'
    },
    operation
  );
}

function reasonCategory(reason: string): string {
  if (reason.startsWith('manual:')) {
    return 'manual';
  }
  return reason;
}
