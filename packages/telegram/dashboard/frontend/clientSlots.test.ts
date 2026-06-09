import { describe, expect, it } from 'vitest';

import type { SlotItemResolution } from '@agentg/framework/dashboard';

import { clientTabFromItem } from './clientSlots.js';

describe('Telegram client slots', () => {
  it('reads the client tab route segment from tab metadata', () => {
    const tab = clientTabFromItem(
      contentItem('history-sync.client', {
        tab: {
          label: 'History Coverage',
          order: 20,
          routeSegment: 'history'
        }
      })
    );

    expect(tab?.routeSegment).toBe('history');
  });

  it('falls back to the final content id segment for client tab routes', () => {
    const tab = clientTabFromItem(
      contentItem('telegram.chat.messages', {
        tab: {
          label: 'Messages',
          order: 10
        }
      })
    );

    expect(tab?.routeSegment).toBe('messages');
  });
});

function contentItem(contentId: string, metadata: Record<string, unknown>): SlotItemResolution {
  return {
    content: {
      contentId,
      load: () => Promise.resolve({ default: { template: '<div />' } }),
      metadata,
      tags: ['telegram.client']
    },
    contentId,
    index: 0,
    kind: 'content'
  };
}
