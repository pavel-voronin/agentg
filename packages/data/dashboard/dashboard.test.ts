import { describe, expect, it } from 'vitest';

import { dashboard } from './dashboard.js';

describe('data dashboard contributions', () => {
  it('owns the routed Data page metadata', () => {
    expect(
      dashboard.contents
        .filter((content) => hasTag(content, 'dashboard.page'))
        .map((content) => ({
          contentId: content.contentId,
          metadata: contentMetadata(content)
        }))
    ).toEqual([
      {
        contentId: 'data.page',
        metadata: {
          page: {
            icon: 'solar:database-bold',
            label: 'Data',
            order: 8,
            routeSegment: 'data'
          }
        }
      }
    ]);
  });
});

type DashboardContent = (typeof dashboard.contents)[number];

function hasTag(content: DashboardContent, tag: string): boolean {
  return (content.tags as readonly string[]).includes(tag);
}

function contentMetadata(content: DashboardContent): Record<string, unknown> | undefined {
  return 'metadata' in content ? content.metadata : undefined;
}
