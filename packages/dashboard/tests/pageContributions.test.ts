import { describe, expect, it } from 'vitest';
import type { ContentDefinition } from '@agentg/framework/dashboard';

import { dashboardContentProvider } from '../src/composition/content/dashboard/provider.js';
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
              icon: 'solar:chart-square-bold',
              label: 'Beta',
              order: 20,
              routeSegment: 'beta'
            }
          },
          tags: ['dashboard.page']
        },
        {
          contentId: 'alpha.page',
          load,
          metadata: {
            page: {
              icon: 'solar:bill-list-bold',
              label: 'Alpha',
              order: 10,
              routeSegment: 'alpha'
            }
          },
          tags: ['dashboard.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'alpha.page',
        icon: 'solar:bill-list-bold',
        isDefault: false,
        label: 'Alpha',
        order: 10,
        routeSegment: 'alpha'
      },
      {
        contentId: 'beta.page',
        icon: 'solar:chart-square-bold',
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
          tags: ['dashboard.page']
        },
        {
          contentId: 'client.page',
          load,
          metadata: {
            page: {
              routeSegment: 'client'
            }
          },
          tags: ['dashboard.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'alpha.page',
        icon: 'solar:widget-2-bold',
        isDefault: false,
        label: 'Alpha',
        order: 100,
        routeSegment: 'alpha'
      },
      {
        contentId: 'client.page',
        icon: 'solar:widget-2-bold',
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
          tags: ['dashboard.header.status']
        },
        {
          contentId: 'alpha.page',
          load,
          tags: ['dashboard.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'alpha.page',
        icon: 'solar:widget-2-bold',
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
          tags: ['dashboard.page']
        },
        {
          contentId: 'default.page',
          load,
          metadata: {
            page: {
              default: true
            }
          },
          tags: ['dashboard.page']
        }
      ] satisfies ContentDefinition[])
    ).toEqual([
      {
        contentId: 'default.page',
        icon: 'solar:widget-2-bold',
        isDefault: true,
        label: 'Default',
        order: 100,
        routeSegment: 'default'
      },
      {
        contentId: 'invalid.page',
        icon: 'solar:widget-2-bold',
        isDefault: false,
        label: 'Invalid',
        order: 100,
        routeSegment: 'invalid'
      }
    ]);
  });

  it('exposes built-in root pages as routed top-level page contributions', () => {
    expect(shellPageContributions(dashboardContentProvider.contents)).toEqual([
      {
        contentId: 'home.page',
        icon: 'solar:home-2-bold',
        isDefault: true,
        label: 'Home',
        order: 0,
        routeSegment: 'home'
      },
      {
        contentId: 'events.stream.page',
        icon: 'solar:bill-list-bold',
        isDefault: false,
        label: 'Events',
        order: 10,
        routeSegment: 'events'
      }
    ]);
    expect(dashboardContentProvider.contents.map((content) => content.tags)).toEqual([
      ['dashboard.header.status'],
      ['dashboard.page'],
      ['dashboard.page']
    ]);
  });
});
