import type { ContentProvider } from '@agentg/framework/cp';

export const controlPlaneContentProvider = {
  contents: [
    {
      contentId: 'status.control',
      load: () => import('./status/statusContent.vue'),
      tags: ['control-plane.header.status']
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
      tags: ['control-plane.page']
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
      tags: ['control-plane.page']
    }
  ],
  domainId: 'control-plane'
} satisfies ContentProvider;
