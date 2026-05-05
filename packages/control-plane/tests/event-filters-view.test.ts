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
          'rpc.telegram.listChats.completed': false,
          'rpc.telegram.listChats.failed': false,
          'rpc.telegram.listChats.progress': true,
          'rpc.telegram.listChats.started': true
        }
      },
      events: []
    });
    const rpcGroup = view.groups.find((group) => group.id === 'rpc');
    const telegramDomain = view.domains.find((domain) => domain.id === 'telegram');
    const tdlibDomain = view.domains.find((domain) => domain.id === 'tdlib');
    const listChatsCall = rpcGroup?.rpcCalls.find((call) => call.target === 'telegram.listChats');
    const completedColumn = rpcGroup?.lifecycleColumns.find(
      (lifecycle) => lifecycle.suffix === 'completed'
    );

    expect(view.domains.map((domain) => domain.id)).toEqual([
      'telegram',
      'tdlib',
      'history',
      'summaries'
    ]);
    expect(telegramDomain).toMatchObject({
      enabledCount: '12',
      eventsChecked: true,
      eventsIndeterminate: false
    });
    expect(telegramDomain?.eventTypes).toContain('telegram.status');
    expect(telegramDomain?.events.map((event) => event.type)).toEqual([
      'telegram.message.created',
      'telegram.message.deleted',
      'telegram.message.updated',
      'telegram.chat.updated',
      'telegram.chat_folders.updated',
      'telegram.user.updated',
      'telegram.status',
      'telegram.login.completed',
      'telegram.login.failed',
      'telegram.login.started'
    ]);
    expect(telegramDomain?.rpc[0]?.rpcCalls.map((call) => call.target)).toContain(
      'telegram.listChats'
    );
    expect(
      telegramDomain?.rpc[0]?.rpcCalls.every((call) => call.target.startsWith('telegram.'))
    ).toBe(true);
    expect(tdlibDomain).toMatchObject({
      enabledCount: '21',
      rpc: []
    });
    expect(tdlibDomain?.events.map((event) => event.type)).toContain(
      'telegram.tdlib.getChat.started'
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
        { enabled: true, label: 'S', type: 'rpc.telegram.listChats.started' },
        { enabled: false, label: 'C', type: 'rpc.telegram.listChats.completed' },
        { enabled: false, label: 'F', type: 'rpc.telegram.listChats.failed' },
        { enabled: true, label: 'P', type: 'rpc.telegram.listChats.progress' }
      ],
      lifecycleTypes: [
        'rpc.telegram.listChats.started',
        'rpc.telegram.listChats.completed',
        'rpc.telegram.listChats.failed',
        'rpc.telegram.listChats.progress'
      ]
    });
    expect(completedColumn).toMatchObject({
      checked: false,
      indeterminate: false
    });
    expect(completedColumn?.types).toContain('rpc.telegram.listChats.completed');

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
    expect(html).not.toContain('Telegram messages');
    expect(html).not.toContain('Telegram chats');
    expect(html).toContain('Toggle Completed RPC calls');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('telegram.listChats');
    expect(html).not.toContain('rpc.telegram.listChats.started');
    expect(html).not.toContain('Event limit');
  });
});
