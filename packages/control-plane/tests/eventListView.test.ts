import { renderToString } from '@vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { describe, expect, it } from 'vitest';

import EventsList from '../src/components/eventsList.vue';
import type {
  AppEventYamlLine,
  AppEventYamlRevealLine,
  AppEventYamlToken,
  AppRpcEventItem,
  AppStandardEventItem,
  ControlPlaneEvent
} from '../src/stores/controlPlaneTypes.js';
import { eventBodyView, expandEventYamlRevealLine } from '../src/view-models/eventYamlView.js';
import { eventListItems } from '../src/view-models/eventsPanelView.js';

describe('event list view', () => {
  it('groups RPC lifecycle events by procedure target in chronological lifecycle order', () => {
    const items = eventListItems(
      [
        rpcEvent('completed', '2026-05-05T00:00:02.000Z', { stage: 'completed' }),
        event('alpha.status', '2026-05-05T00:00:01.500Z', { online: true }),
        rpcEvent('started', '2026-05-05T00:00:01.000Z', { stage: 'started' })
      ],
      (type) => type === 'alpha.rpc.listItems.started'
    );

    expect(items.map((item) => item.kind)).toEqual(['rpc', 'event']);

    const rpcItem = items[0] as AppRpcEventItem;
    expect(rpcItem).toMatchObject({
      callId: 'call_1',
      kind: 'rpc',
      muted: false,
      target: 'alpha.listItems'
    });
    expect(rpcItem.lifecycleTypes).toEqual([
      'alpha.rpc.listItems.started',
      'alpha.rpc.listItems.completed'
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
      raw: '{"callId":"call_1","target":"alpha.listItems","stage":"completed"}'
    });
    expect(linesText(rpcItem.lifecycles[1]?.body.yamlLines ?? [])).toBe(
      'callId: call_1\ntarget: alpha.listItems\nstage: completed'
    );
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
    expect(html).toContain('alpha.listItems');
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
        event('beta.sync.requested', '2026-05-05T00:00:01.000Z', {
          chat: {
            _model: 'alpha.record',
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
    const firstLine = eventItem.body.yamlLines[0];
    if (firstLine?.kind !== 'content') {
      throw new Error('Expected first YAML line to be content');
    }
    const modelRefToken = firstLine.tokens[1];

    expect(eventItem.body.raw).toContain('"_model":"alpha.record"');
    expect(linesText(eventItem.body.yamlLines)).toBe(
      'chat: alpha.record chat-a\n  title: "Chat A"\n  type: private\nreason: manual'
    );
    expect(firstLine.tokens[0]).toEqual({ kind: 'text', text: 'chat: ' });
    expect(modelRefToken).toMatchObject({
      id: 'chat-a',
      kind: 'modelRef',
      model: 'alpha.record'
    });
    expect(modelRefToken?.kind === 'modelRef' ? modelRefToken.color : '').toMatch(/^#/);

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(EventsList, { events: items, hasEvents: true });
        }
      })
    );

    expect(html).toContain('alpha.record');
    expect(html).toContain('title="alpha.record chat-a"');
    expect(html).toContain('chat-a');
    expect(html).toContain('title:');
    expect(html).toContain('Chat A');
    expect(html).toContain('type: private');
    expect(html).not.toContain('_model:');
    expect(html).not.toContain('&quot;_model&quot;');
  });

  it('renders long YAML lists behind a current-level more row', async () => {
    const items = Array.from({ length: 15 }, (_, index) => ({
      children: [`child-${String(index + 1)}-1`, `child-${String(index + 1)}-2`],
      id: `item-${String(index + 1)}`
    }));
    const body = eventBodyView({ items });
    const reveal = onlyReveal(body.yamlLines);

    expect(reveal).toMatchObject({
      hiddenCount: 3,
      indent: 1
    });
    expect(linesText(body.yamlLines)).toContain('- children:');
    expect(linesText(body.yamlLines)).toContain('item-12');
    expect(linesText(body.yamlLines)).toContain('3 more');
    expect(linesText(body.yamlLines)).not.toContain('item-13');

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(EventsList, {
            events: [
              eventListItem({
                data: { items },
                id: 'long-list',
                occurredAt: '2026-05-05T00:00:01.000Z',
                type: 'alpha.longList'
              })
            ],
            hasEvents: true
          });
        }
      })
    );

    expect(html).toContain('3 more');
    expect(html).toContain('item-12');
    expect(html).not.toContain('item-13');
  });

  it('does not add a more row for exactly twelve YAML list items', () => {
    const body = eventBodyView({
      items: Array.from({ length: 12 }, (_, index) => `item-${String(index + 1)}`)
    });

    expect(body.yamlLines.filter((line) => line.kind === 'reveal')).toHaveLength(0);
    expect(linesText(body.yamlLines)).toContain('item-12');
    expect(linesText(body.yamlLines)).not.toContain('more');
  });

  it('uses a configured YAML list item limit', () => {
    const body = eventBodyView(
      {
        items: Array.from({ length: 5 }, (_, index) => `item-${String(index + 1)}`)
      },
      { listItemLimit: 3 }
    );
    const reveal = onlyReveal(body.yamlLines);

    expect(reveal).toMatchObject({
      hiddenCount: 2,
      listItemLimit: 3,
      startIndex: 3
    });
    expect(linesText(body.yamlLines)).toContain('item-3');
    expect(linesText(body.yamlLines)).not.toContain('item-4');
  });

  it('uses per-event YAML list item limit snapshots', () => {
    const items = eventListItems(
      [
        {
          ...event('alpha.snapshot.first', '2026-05-05T00:00:01.000Z', {
            items: ['a', 'b', 'c', 'd', 'e']
          }),
          yamlListItemLimit: 2
        },
        {
          ...event('alpha.snapshot.second', '2026-05-05T00:00:02.000Z', {
            items: ['a', 'b', 'c', 'd', 'e']
          }),
          yamlListItemLimit: 4
        }
      ],
      () => false,
      { yaml: { listItemLimit: 1 } }
    );
    const firstEvent = items[0] as AppStandardEventItem;
    const secondEvent = items[1] as AppStandardEventItem;
    const firstReveal = onlyReveal(firstEvent.body.yamlLines);
    const secondReveal = onlyReveal(secondEvent.body.yamlLines);

    expect(firstReveal).toMatchObject({
      hiddenCount: 3,
      listItemLimit: 2
    });
    expect(secondReveal).toMatchObject({
      hiddenCount: 1,
      listItemLimit: 4
    });
  });

  it('expands a hidden list tail without expanding nested list tails', () => {
    const items = Array.from({ length: 13 }, (_, index) => ({
      id: `item-${String(index + 1)}`,
      values: Array.from({ length: 13 }, (_, valueIndex) => `value-${String(valueIndex + 1)}`)
    }));
    const body = eventBodyView({ items });
    const rootReveal = onlyReveal(
      body.yamlLines.filter((line) => line.kind === 'reveal' && line.indent === 1)
    );
    const expandedRootLines = expandEventYamlRevealLine(rootReveal);
    const nestedReveal = onlyReveal(expandedRootLines);

    expect(rootReveal.hiddenCount).toBe(1);
    expect(linesText(expandedRootLines)).toContain('item-13');
    expect(linesText(expandedRootLines)).toContain('value-12');
    expect(linesText(expandedRootLines)).not.toContain('value-13');
    expect(nestedReveal).toMatchObject({
      hiddenCount: 1
    });
  });

  it('keeps lazy expansion indentation for a long first field inside a list item', () => {
    const body = eventBodyView({
      items: [
        {
          values: Array.from({ length: 13 }, (_, valueIndex) => `value-${String(valueIndex + 1)}`),
          id: 'item-1'
        }
      ]
    });
    const nestedReveal = onlyReveal(body.yamlLines.filter((line) => line.kind === 'reveal'));
    const expandedNestedLines = expandEventYamlRevealLine(nestedReveal);
    const firstExpandedLine = expandedNestedLines[0];

    expect(nestedReveal).toMatchObject({
      depth: 3,
      hiddenCount: 1,
      indent: 3
    });
    expect(firstExpandedLine).toMatchObject({
      indent: 3,
      kind: 'content'
    });
    expect(linesText(expandedNestedLines)).toBe('      - value-13');
  });
});

function rpcEvent(
  suffix: 'completed' | 'failed' | 'progress' | 'started',
  occurredAt: string,
  data: Record<string, unknown>,
  callId = 'call_1'
): ControlPlaneEvent {
  return event(`alpha.rpc.listItems.${suffix}`, occurredAt, {
    callId,
    target: 'alpha.listItems',
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

function eventListItem(event: ControlPlaneEvent): AppStandardEventItem {
  return eventListItems([event], () => false)[0] as AppStandardEventItem;
}

function linesText(lines: AppEventYamlLine[]): string {
  return lines.map(lineText).join('\n');
}

function lineText(line: AppEventYamlLine): string {
  if (line.kind === 'reveal') {
    return `${'  '.repeat(line.indent)}${String(line.hiddenCount)} more`;
  }
  return `${'  '.repeat(line.indent)}${line.tokens.map(tokenText).join('')}`;
}

function tokenText(token: AppEventYamlToken): string {
  return token.kind === 'text' ? token.text : `${token.model} ${token.id}`;
}

function onlyReveal(lines: AppEventYamlLine[]): AppEventYamlRevealLine {
  const reveals = lines.filter((line): line is AppEventYamlRevealLine => line.kind === 'reveal');
  expect(reveals).toHaveLength(1);
  const reveal = reveals[0];
  if (reveal === undefined) {
    throw new Error('Expected one reveal YAML line');
  }
  return reveal;
}
