import { renderToString } from '@vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { describe, expect, it } from 'vitest';

import EventFilters from '../src/components/eventFilters.vue';
import { defaultEventFilters } from '../src/domain/events.js';
import { eventFiltersPanelView } from '../src/view-models/eventsPanelView.js';

describe('event filters view', () => {
  it('keeps domain event filters and RPC lifecycle filters in the same domain tab', () => {
    const view = eventFiltersPanelView({
      eventCatalog: {
        services: [
          {
            events: ['alpha.message.created'],
            procedures: [{ kind: 'procedure', name: 'alpha.listItems' }],
            slug: 'alpha'
          }
        ],
        version: 1
      },
      eventFilters: defaultEventFilters(),
      events: [
        {
          data: {},
          type: 'alpha.message.created'
        },
        {
          data: {
            callId: 'call-a',
            target: 'alpha.listItems'
          },
          type: 'alpha.rpc.listItems.started'
        }
      ]
    });
    const alphaDomain = view.domains.find((domain) => domain.id === 'alpha');

    expect(view.domains.map((domain) => domain.id)).toEqual(['alpha']);
    expect(alphaDomain?.eventTypes).toEqual(['alpha.message.created']);
    expect(alphaDomain?.rpc[0]?.rpcCalls.map((call) => call.target)).toEqual(['alpha.listItems']);
  });

  it('collapses RPC lifecycle event types into call rows with fixed lifecycle columns', async () => {
    const view = eventFiltersPanelView({
      eventCatalog: {
        services: [
          {
            events: [],
            procedures: [{ kind: 'procedure', name: 'alpha.listItems' }],
            slug: 'alpha'
          }
        ],
        version: 1
      },
      eventFilters: {
        ...defaultEventFilters(),
        types: {
          'alpha.rpc.listItems.completed': false,
          'alpha.rpc.listItems.failed': false,
          'alpha.rpc.listItems.progress': true,
          'alpha.rpc.listItems.started': true
        }
      },
      events: []
    });
    const rpcGroup = view.groups.find((group) => group.id === 'rpc');
    const alphaDomain = view.domains.find((domain) => domain.id === 'alpha');
    const listChatsCall = rpcGroup?.rpcCalls.find((call) => call.target === 'alpha.listItems');
    const completedColumn = rpcGroup?.lifecycleColumns.find(
      (lifecycle) => lifecycle.suffix === 'completed'
    );

    expect(view.domains.map((domain) => domain.id)).toEqual(['alpha']);
    expect(alphaDomain).toMatchObject({
      enabledCount: '2',
      eventTypes: [],
      events: [],
      eventsChecked: false,
      eventsIndeterminate: false
    });
    expect(alphaDomain?.rpc[0]?.rpcCalls.map((call) => call.target)).toContain('alpha.listItems');
    expect(alphaDomain?.rpc[0]?.rpcCalls.every((call) => call.target.startsWith('alpha.'))).toBe(
      true
    );
    expect(rpcGroup).toMatchObject({
      kind: 'rpc',
      lifecycleColumns: [
        { label: 'S', suffix: 'started' },
        { label: 'C', suffix: 'completed' },
        { label: 'F', suffix: 'failed' },
        { label: 'P', suffix: 'progress' }
      ]
    });
    expect(listChatsCall).toMatchObject({
      checked: false,
      indeterminate: true,
      lifecycles: [
        { enabled: true, label: 'S', type: 'alpha.rpc.listItems.started' },
        { enabled: false, label: 'C', type: 'alpha.rpc.listItems.completed' },
        { enabled: false, label: 'F', type: 'alpha.rpc.listItems.failed' },
        { enabled: true, label: 'P', type: 'alpha.rpc.listItems.progress' }
      ],
      lifecycleTypes: [
        'alpha.rpc.listItems.started',
        'alpha.rpc.listItems.completed',
        'alpha.rpc.listItems.failed',
        'alpha.rpc.listItems.progress'
      ]
    });
    expect(completedColumn).toMatchObject({
      checked: false,
      indeterminate: false
    });
    expect(completedColumn?.types).toContain('alpha.rpc.listItems.completed');

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(EventFilters, { view });
        }
      })
    );

    expect(html).toContain('RPC calls');
    expect(html).toContain('All');
    expect(html).toContain('None');
    expect(html).toContain('role="tab"');
    expect(html).not.toContain('Alpha messages');
    expect(html).not.toContain('Alpha chats');
    expect(html).toContain('Toggle Completed RPC calls');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('alpha.listItems');
    expect(html).not.toContain('alpha.rpc.listItems.started');
    expect(html).not.toContain('Event limit');
  });
});
