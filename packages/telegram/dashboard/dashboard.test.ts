import { describe, expect, it } from 'vitest';

import { dashboard } from './dashboard.js';

type DashboardContent = (typeof dashboard.contents)[number];

describe('telegram dashboard contributions', () => {
  it('owns the routed client page metadata', () => {
    expect(
      dashboard.contents
        .filter((content) => hasTag(content, 'dashboard.page'))
        .map((content) => ({
          contentId: content.contentId,
          metadata: contentMetadata(content)
        }))
    ).toEqual([
      {
        contentId: 'telegram.client.page',
        metadata: {
          page: {
            icon: 'solar:chat-square-code-bold',
            label: 'Client',
            order: 5,
            routeSegment: 'client'
          }
        }
      }
    ]);
  });

  it('registers the chat-level client tabs', () => {
    expect(
      dashboard.contents
        .filter((content) => hasTag(content, 'telegram.client'))
        .map((content) => ({
          contentId: content.contentId,
          metadata: contentMetadata(content)
        }))
    ).toEqual([
      {
        contentId: 'telegram.chat.messages',
        metadata: {
          tab: {
            label: 'Messages',
            order: 10
          }
        }
      },
      {
        contentId: 'telegram.chat.historyCoverage',
        metadata: {
          tab: {
            label: 'History Coverage',
            order: 20,
            routeSegment: 'history'
          }
        }
      }
    ]);
  });
});

function hasTag(content: DashboardContent, tag: string): boolean {
  return (content.tags as readonly string[]).includes(tag);
}

function contentMetadata(content: DashboardContent): Record<string, unknown> | undefined {
  return 'metadata' in content ? content.metadata : undefined;
}
