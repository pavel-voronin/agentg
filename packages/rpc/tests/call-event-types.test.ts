import { describe, expect, it } from 'vitest';

import {
  RPC_CALL_COMPLETED_EVENT_SUFFIX,
  RPC_CALL_STARTED_EVENT_SUFFIX,
  rpcCallEventTarget,
  rpcCallEventType,
  rpcCallEventTypesForProcedure,
  serviceManifestEventTypes
} from '../src/call-event-types.js';

describe('RPC call event types', () => {
  it('uses the domain as the first event type segment', () => {
    expect(
      rpcCallEventType('history-sync.getChatHistorySyncState', RPC_CALL_STARTED_EVENT_SUFFIX)
    ).toBe('history-sync.rpc.getChatHistorySyncState.started');
    expect(rpcCallEventTarget('history-sync.rpc.getChatHistorySyncState.completed')).toBe(
      'history-sync.getChatHistorySyncState'
    );
    expect(rpcCallEventTarget('rpc.history-sync.getChatHistorySyncState.completed')).toBeNull();
  });

  it('preserves nested procedure segments', () => {
    const type = rpcCallEventType('alpha.admin.listItems', RPC_CALL_COMPLETED_EVENT_SUFFIX);

    expect(type).toBe('alpha.rpc.admin.listItems.completed');
    expect(rpcCallEventTarget(type)).toBe('alpha.admin.listItems');
  });

  it('derives every RPC lifecycle event type from procedure manifests', () => {
    expect(rpcCallEventTypesForProcedure('alpha.listItems')).toEqual([
      'alpha.rpc.listItems.started',
      'alpha.rpc.listItems.completed',
      'alpha.rpc.listItems.failed',
      'alpha.rpc.listItems.progress'
    ]);
    expect(
      serviceManifestEventTypes({
        events: ['alpha.message.created'],
        procedures: [{ name: 'alpha.listItems' }]
      })
    ).toEqual([
      'alpha.message.created',
      'alpha.rpc.listItems.started',
      'alpha.rpc.listItems.completed',
      'alpha.rpc.listItems.failed',
      'alpha.rpc.listItems.progress'
    ]);
  });
});
