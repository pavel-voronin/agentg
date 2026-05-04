import { describe, expect, it, vi } from 'vitest';

import { createControlPlaneApi } from '../src/control-plane/controlPlaneApi.js';

describe('createControlPlaneApi', () => {
  it('omits an empty chat search query for controlPlane.listChats', async () => {
    const rpc = vi.fn().mockResolvedValue({
      chats: [],
      navigation: {}
    });
    const api = createControlPlaneApi({
      rpc: rpc as Parameters<typeof createControlPlaneApi>[0]['rpc']
    });

    await api.listChats({
      folderId: null,
      listMode: 'main',
      query: ''
    });

    expect(rpc).toHaveBeenCalledWith('controlPlane.listChats', {
      limit: 500,
      list: 'main'
    });
  });

  it('sends a trimmed non-empty chat search query for controlPlane.listChats', async () => {
    const rpc = vi.fn().mockResolvedValue({
      chats: [],
      navigation: {}
    });
    const api = createControlPlaneApi({
      rpc: rpc as Parameters<typeof createControlPlaneApi>[0]['rpc']
    });

    await api.listChats({
      folderId: null,
      listMode: 'main',
      query: '  kolpaque  '
    });

    expect(rpc).toHaveBeenCalledWith('controlPlane.listChats', {
      limit: 500,
      query: 'kolpaque'
    });
  });

  it('normalizes Control Plane and History RPC responses into UI models', async () => {
    const rpc = vi.fn(<T = unknown>(method: string): Promise<T> => {
      if (method === 'controlPlane.getOverview') {
        return Promise.resolve({
          activeJob: {
            chatId: 'chat-a',
            endAt: '2026-05-01T01:00:00.000Z',
            startAt: '2026-05-01T00:00:00.000Z',
            status: 'running'
          },
          chats: 1,
          coverageIntervals: 2,
          pendingJobs: 3,
          runningJobs: 4,
          targets: 5,
          templates: 6
        } as T);
      }
      return Promise.resolve({
        chat: {
          historyBeginningReached: true,
          historyStartAt: '2026-04-01T00:00:00.000Z',
          id: 'chat-a',
          isBot: false,
          messageCount: 7,
          title: 'Saved Messages',
          type: 'private',
          updatedAt: '2026-05-01T00:00:00.000Z'
        },
        coverage: [
          {
            endAt: '2026-05-01T00:00:00.000Z',
            messageCount: 7,
            startAt: '2026-04-01T00:00:00.000Z'
          }
        ],
        desired: [],
        jobs: [],
        missing: [],
        targets: [
          {
            chatId: 'chat-a',
            id: 'target-a',
            range: {
              end: { expression: 'now', kind: 'expression' },
              start: { expression: 'past', kind: 'expression' }
            }
          }
        ]
      } as T);
    });
    const api = createControlPlaneApi({
      rpc: rpc as Parameters<typeof createControlPlaneApi>[0]['rpc']
    });

    await expect(api.getOverview()).resolves.toEqual({
      activeJob: {
        chatId: 'chat-a',
        endAt: '2026-05-01T01:00:00.000Z',
        startAt: '2026-05-01T00:00:00.000Z',
        status: 'running'
      },
      chats: 1,
      coverageIntervals: 2,
      pendingJobs: 3,
      runningJobs: 4,
      targets: 5,
      templates: 6
    });

    await expect(api.getChatHistoryState('chat-a')).resolves.toMatchObject({
      chat: {
        id: 'chat-a',
        messageCount: 7,
        title: 'Saved Messages'
      },
      coverage: [
        {
          messageCount: 7,
          startAt: '2026-04-01T00:00:00.000Z'
        }
      ],
      targets: [
        {
          chatId: 'chat-a',
          id: 'target-a'
        }
      ]
    });
  });
});
