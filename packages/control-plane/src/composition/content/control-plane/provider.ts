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
          icon: 'home',
          label: 'Home',
          order: 0,
          routeSegment: 'home'
        }
      },
      tags: ['control-plane.page']
    },
    {
      contentId: 'client.page',
      load: () => import('./client/clientPageContent.vue'),
      metadata: {
        page: {
          icon: 'client',
          label: 'Client',
          order: 5,
          routeSegment: 'client'
        }
      },
      tags: ['control-plane.page']
    },
    {
      contentId: 'events.stream.page',
      load: () => import('../events/eventStreamContent.vue'),
      metadata: {
        page: {
          icon: 'events',
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
