import { collectModelRefs } from '@agentg/shared/rpc/model-refs';
import { describe, expect, it } from 'vitest';

import { createExtensionRegistry } from '../src/registry.js';
import { createExtensionRegistryRouter } from '../src/rpc/router.js';

describe('extension registry', () => {
  it('registers, refreshes, lists, and expires extension registrations', () => {
    const registry = createExtensionRegistry({ ttlMs: 1000 });
    const registeredAt = new Date('2026-05-04T00:00:00.000Z');
    const refreshedAt = new Date('2026-05-04T00:00:00.500Z');

    expect(
      registry.register(
        {
          extension: 'summaries.chatSummary',
          target: 'telegram.chat'
        },
        registeredAt
      )
    ).toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: false,
      registered: true,
      target: 'telegram.chat'
    });

    expect(
      registry.register(
        {
          extension: 'summaries.chatSummary',
          target: 'telegram.chat'
        },
        refreshedAt
      )
    ).toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: true,
      registered: false,
      target: 'telegram.chat'
    });

    registry.register(
      {
        extension: 'topics.chatTopics',
        target: 'telegram.chat'
      },
      refreshedAt
    );
    registry.register(
      {
        extension: 'summaries.historyState',
        target: 'history.getChatHistoryState'
      },
      refreshedAt
    );

    expect(registry.list({ target: 'telegram.chat' }, refreshedAt)).toEqual([
      {
        expiresAt: '2026-05-04T00:00:01.500Z',
        extension: 'summaries.chatSummary',
        registeredAt: '2026-05-04T00:00:00.000Z',
        target: 'telegram.chat'
      },
      {
        expiresAt: '2026-05-04T00:00:01.500Z',
        extension: 'topics.chatTopics',
        registeredAt: '2026-05-04T00:00:00.500Z',
        target: 'telegram.chat'
      }
    ]);

    expect(
      registry.list(undefined, refreshedAt).map((registration) => registration.target)
    ).toEqual(['history.getChatHistoryState', 'telegram.chat', 'telegram.chat']);
    expect(
      registry.list({ target: 'telegram.chat' }, new Date('2026-05-04T00:00:01.501Z'))
    ).toEqual([]);
  });

  it('exposes direct tRPC register and list procedures', async () => {
    const registry = createExtensionRegistry({ ttlMs: 60_000 });
    const caller = createExtensionRegistryRouter(registry).createCaller({});

    await expect(
      caller.registerExtension({
        extension: 'summaries.chatSummary',
        target: 'telegram.chat'
      })
    ).resolves.toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: false,
      registered: true,
      target: 'telegram.chat'
    });

    await expect(caller.listExtensions({ target: 'telegram.chat' })).resolves.toMatchObject({
      extensions: [
        {
          extension: 'summaries.chatSummary',
          target: 'telegram.chat'
        }
      ]
    });
  });
});

describe('collectModelRefs', () => {
  it('collects unique model refs from nested JSON-shaped values', () => {
    const circular: Record<string, unknown> = {
      _model: 'telegram.chat',
      id: 'chat-a',
      title: 'Chat A'
    };
    circular.self = circular;

    expect(
      collectModelRefs({
        chat: circular,
        invalid: {
          _model: 'telegram.chat'
        },
        items: [
          {
            _model: 'telegram.chat',
            id: 'chat-a'
          },
          {
            _model: 'telegram.message',
            id: 'message-a'
          },
          {
            id: 'missing-model'
          }
        ]
      })
    ).toEqual([
      {
        _model: 'telegram.chat',
        id: 'chat-a'
      },
      {
        _model: 'telegram.message',
        id: 'message-a'
      }
    ]);
  });
});
