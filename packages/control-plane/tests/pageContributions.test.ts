import { describe, expect, it } from 'vitest';
import type { ContentDefinition } from '@agentg/framework/cp';

import { controlPlaneContentProvider } from '../src/composition/content/control-plane/provider.js';
import { shellPageContributions } from '../src/view-models/pageContributions.js';

describe('shell page contributions', () => {
  it('projects generic page metadata from slot contents', () => {
    const load = () => Promise.resolve({ default: {} });

    expect(
      shellPageContributions([
        {
          contentId: 'beta.page',
          load,
          metadata: {
            page: {
              icon: 'telemetry',
              label: 'Beta',
              order: 20,
              routeSegment: 'beta'
            }
          },
          tags: ['control-plane.page']
        },
        {
          contentId: 'alpha.page',
          load,
          metadata: {
            page: {
              icon: 'events',
              label: 'Alpha',
              order: 10,
              routeSegment: 'alpha'
            }
          },
          tags: ['control-plane.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'alpha.page',
        icon: 'events',
        isDefault: false,
        label: 'Alpha',
        order: 10,
        routeSegment: 'alpha'
      },
      {
        contentId: 'beta.page',
        icon: 'telemetry',
        isDefault: false,
        label: 'Beta',
        order: 20,
        routeSegment: 'beta'
      }
    ]);
  });

  it('fills page defaults from the content id and route segment', () => {
    const load = () => Promise.resolve({ default: {} });

    expect(
      shellPageContributions([
        {
          contentId: 'alpha.page',
          load,
          tags: ['control-plane.page']
        },
        {
          contentId: 'client.page',
          load,
          metadata: {
            page: {
              routeSegment: 'client'
            }
          },
          tags: ['control-plane.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'alpha.page',
        icon: 'page',
        isDefault: false,
        label: 'Alpha',
        order: 100,
        routeSegment: 'alpha'
      },
      {
        contentId: 'client.page',
        icon: 'client',
        isDefault: false,
        label: 'Client',
        order: 100,
        routeSegment: 'client'
      }
    ]);
  });

  it('ignores content outside the page slot contract', () => {
    const load = () => Promise.resolve({ default: {} });

    expect(
      shellPageContributions([
        {
          contentId: 'status.control',
          load,
          tags: ['control-plane.header.status']
        },
        {
          contentId: 'alpha.page',
          load,
          tags: ['control-plane.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'alpha.page',
        icon: 'page',
        isDefault: false,
        label: 'Alpha',
        order: 100,
        routeSegment: 'alpha'
      }
    ]);
  });

  it('uses deterministic defaults for invalid page metadata fields', () => {
    const load = () => Promise.resolve({ default: {} });

    expect(
      shellPageContributions([
        {
          contentId: 'invalid.page',
          load,
          metadata: {
            page: {
              icon: 'unknown',
              label: '',
              routeSegment: 'nested/page'
            }
          },
          tags: ['control-plane.page']
        },
        {
          contentId: 'default.page',
          load,
          metadata: {
            page: {
              default: true
            }
          },
          tags: ['control-plane.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'default.page',
        icon: 'page',
        isDefault: true,
        label: 'Default',
        order: 100,
        routeSegment: 'default'
      },
      {
        contentId: 'invalid.page',
        icon: 'page',
        isDefault: false,
        label: 'Invalid',
        order: 100,
        routeSegment: 'invalid'
      }
    ]);
  });

  it('exposes built-in pages as routed top-level page contributions', () => {
    expect(shellPageContributions(controlPlaneContentProvider.contents)).toEqual([
      {
        contentId: 'home.page',
        icon: 'home',
        isDefault: true,
        label: 'Home',
        order: 0,
        routeSegment: 'home'
      },
      {
        contentId: 'client.page',
        icon: 'client',
        isDefault: false,
        label: 'Client',
        order: 5,
        routeSegment: 'client'
      },
      {
        contentId: 'events.stream.page',
        icon: 'events',
        isDefault: false,
        label: 'Events',
        order: 10,
        routeSegment: 'events'
      }
    ]);
    expect(controlPlaneContentProvider.contents.map((content) => content.tags)).toEqual([
      ['control-plane.header.status'],
      ['control-plane.page'],
      ['control-plane.page'],
      ['control-plane.page']
    ]);
  });
});
