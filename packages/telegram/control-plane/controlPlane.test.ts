import { describe, expect, it } from 'vitest';

import { controlPlane } from './controlPlane.js';

type ControlPlaneContent = (typeof controlPlane.contents)[number];

describe('telegram control plane contributions', () => {
  it('owns the routed client page metadata', () => {
    expect(
      controlPlane.contents
        .filter((content) => hasTag(content, 'control-plane.page'))
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
});

function hasTag(content: ControlPlaneContent, tag: string): boolean {
  return (content.tags as readonly string[]).includes(tag);
}

function contentMetadata(content: ControlPlaneContent): Record<string, unknown> | undefined {
  return 'metadata' in content ? content.metadata : undefined;
}
