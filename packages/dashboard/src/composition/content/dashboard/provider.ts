import type { ContentProvider } from '@agentg/framework/dashboard';

export const dashboardContentProvider = {
  contents: [
    {
      contentId: 'status.control',
      load: () => import('./status/statusContent.vue'),
      tags: ['dashboard.header.status']
    },
    {
      contentId: 'home.page',
      load: () => import('./home/homePageContent.vue'),
      metadata: {
        page: {
          default: true,
          icon: 'solar:home-2-bold',
          label: 'Home',
          order: 0,
          routeSegment: 'home'
        }
      },
      tags: ['dashboard.page']
    },
    {
      contentId: 'events.stream.page',
      load: () => import('../events/eventStreamContent.vue'),
      metadata: {
        page: {
          icon: 'solar:bill-list-bold',
          label: 'Events',
          order: 10,
          routeSegment: 'events'
        }
      },
      tags: ['dashboard.page']
    }
  ],
  domainId: 'dashboard'
} satisfies ContentProvider;
