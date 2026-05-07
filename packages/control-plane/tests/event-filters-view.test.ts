import { renderToString } from '@vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { describe, expect, it } from 'vitest';

import EventFilters from '../src/components/EventFilters.vue';
import { defaultEventFilters } from '../src/domain/events.js';
import { eventFiltersPanelView } from '../src/view-models/eventsPanelView.js';

describe('event filters view', () => {
  it('collapses RPC lifecycle event types into call rows with fixed lifecycle columns', async () => {
    const view = eventFiltersPanelView({
      eventFilters: {
        ...defaultEventFilters(),
        types: {
          'rpc.alpha.listItems.completed': false,
          'rpc.alpha.listItems.failed': false,
          'rpc.alpha.listItems.progress': true,
          'rpc.alpha.listItems.started': true
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
        { enabled: true, label: 'S', type: 'rpc.alpha.listItems.started' },
        { enabled: false, label: 'C', type: 'rpc.alpha.listItems.completed' },
        { enabled: false, label: 'F', type: 'rpc.alpha.listItems.failed' },
        { enabled: true, label: 'P', type: 'rpc.alpha.listItems.progress' }
      ],
      lifecycleTypes: [
        'rpc.alpha.listItems.started',
        'rpc.alpha.listItems.completed',
        'rpc.alpha.listItems.failed',
        'rpc.alpha.listItems.progress'
      ]
    });
    expect(completedColumn).toMatchObject({
      checked: false,
      indeterminate: false
    });
    expect(completedColumn?.types).toContain('rpc.alpha.listItems.completed');

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
    expect(html).not.toContain('rpc.alpha.listItems.started');
    expect(html).not.toContain('Event limit');
  });
});
