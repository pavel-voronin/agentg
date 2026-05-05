import { renderToString } from '@vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { describe, expect, it } from 'vitest';

import EventsList from '../src/components/EventsList.vue';
import type {
  AppRpcEventItem,
  AppStandardEventItem,
  ControlPlaneEvent
} from '../src/stores/controlPlaneTypes.js';
import { eventListItems } from '../src/view-models/eventsPanelView.js';

describe('event list view', () => {
  it('groups RPC lifecycle events by procedure target in chronological lifecycle order', () => {
    const items = eventListItems(
      [
        rpcEvent('completed', '2026-05-05T00:00:02.000Z', { stage: 'completed' }),
        event('telegram.status', '2026-05-05T00:00:01.500Z', { online: true }),
        rpcEvent('started', '2026-05-05T00:00:01.000Z', { stage: 'started' })
      ],
      (type) => type === 'rpc.telegram.listChats.started'
    );

    expect(items.map((item) => item.kind)).toEqual(['rpc', 'event']);

    const rpcItem = items[0] as AppRpcEventItem;
    expect(rpcItem).toMatchObject({
      callId: 'call_1',
      kind: 'rpc',
      muted: false,
      target: 'telegram.listChats'
    });
    expect(rpcItem.lifecycleTypes).toEqual([
      'rpc.telegram.listChats.started',
      'rpc.telegram.listChats.completed'
    ]);
    expect(rpcItem.lifecycles.map((lifecycle) => lifecycle.suffix)).toEqual([
      'started',
      'completed'
    ]);
    expect(rpcItem.lifecycles.map((lifecycle) => lifecycle.occurredAt)).toEqual([
      '2026-05-05 00:00:01.000',
      '+1000 ms'
    ]);
    expect(rpcItem.lifecycles[1]?.body).toMatchObject({
      raw: '{"callId":"call_1","target":"telegram.listChats","stage":"completed"}',
      yaml: 'callId: call_1\ntarget: telegram.listChats\nstage: completed'
    });
    expect(rpcItem.lifecycles.map((lifecycle) => lifecycle.muted)).toEqual([true, false]);
  });

  it('keeps concurrent calls of the same RPC procedure as separate stream items', () => {
    const items = eventListItems(
      [
        rpcEvent('completed', '2026-05-05T00:00:03.000Z', { stage: 'completed' }, 'call_2'),
        rpcEvent('completed', '2026-05-05T00:00:02.000Z', { stage: 'completed' }, 'call_1'),
        rpcEvent('started', '2026-05-05T00:00:01.000Z', { stage: 'started' }, 'call_1')
      ],
      () => false
    );

    const rpcItems = items.filter((item): item is AppRpcEventItem => item.kind === 'rpc');

    expect(rpcItems.map((item) => item.callId)).toEqual(['call_2', 'call_1']);
    expect(rpcItems[0]?.lifecycles.map((lifecycle) => lifecycle.suffix)).toEqual(['completed']);
    expect(rpcItems[1]?.lifecycles.map((lifecycle) => lifecycle.suffix)).toEqual([
      'started',
      'completed'
    ]);
  });

  it('renders only the latest RPC lifecycle body expanded by default', async () => {
    const items = eventListItems(
      [
        rpcEvent('completed', '2026-05-05T00:00:02.000Z', { stage: 'completed' }),
        rpcEvent('started', '2026-05-05T00:00:01.000Z', { stage: 'started' })
      ],
      () => false
    );

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(EventsList, { events: items, hasEvents: true });
        }
      })
    );

    expect(html).toContain('RPC call');
    expect(html).toContain('telegram.listChats');
    expect(html).toContain('Started');
    expect(html).toContain('Completed');
    expect(html).toContain('2026-05-05 00:00:01.000');
    expect(html).toContain('+1000 ms');
    expect(html).toContain('YAML');
    expect(html).not.toContain('RAW');
    expect(html).not.toContain('stage: started');
    expect(html).toContain('callId: call_1');
    expect(html).toContain('stage: completed');
    expect(html).not.toContain('{&quot;callId&quot;:&quot;call_1&quot;');
  });

  it('renders ModelRef values as YAML badges without changing RAW payload text', async () => {
    const items = eventListItems(
      [
        event('history.sync.requested', '2026-05-05T00:00:01.000Z', {
          chat: {
            _model: 'telegram.chat',
            id: 'chat-a',
            title: 'Chat A',
            type: 'private'
          },
          reason: 'manual'
        })
      ],
      () => false
    );

    const eventItem = items[0] as AppStandardEventItem;
    const modelRefToken = eventItem.body.yamlLines[0]?.tokens[1];

    expect(eventItem.body.raw).toContain('"_model":"telegram.chat"');
    expect(eventItem.body.yaml).toBe(
      'chat: telegram.chat chat-a\n  title: "Chat A"\n  type: private\nreason: manual'
    );
    expect(eventItem.body.yamlLines[0]?.tokens[0]).toEqual({ kind: 'text', text: 'chat: ' });
    expect(modelRefToken).toMatchObject({
      id: 'chat-a',
      kind: 'modelRef',
      model: 'telegram.chat'
    });
    expect(modelRefToken?.kind === 'modelRef' ? modelRefToken.color : '').toMatch(/^#/);

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(EventsList, { events: items, hasEvents: true });
        }
      })
    );

    expect(html).toContain('telegram.chat');
    expect(html).toContain('title="telegram.chat chat-a"');
    expect(html).toContain('chat-a');
    expect(html).toContain('title:');
    expect(html).toContain('Chat A');
    expect(html).toContain('type: private');
    expect(html).not.toContain('_model:');
    expect(html).not.toContain('&quot;_model&quot;');
  });
});

function rpcEvent(
  suffix: 'completed' | 'failed' | 'progress' | 'started',
  occurredAt: string,
  data: Record<string, unknown>,
  callId = 'call_1'
): ControlPlaneEvent {
  return event(`rpc.telegram.listChats.${suffix}`, occurredAt, {
    callId,
    target: 'telegram.listChats',
    ...data
  });
}

function event(type: string, occurredAt: string, data: unknown): ControlPlaneEvent {
  return {
    data,
    id: `${type}:${occurredAt}`,
    occurredAt,
    type
  };
}
