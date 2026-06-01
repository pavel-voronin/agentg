import type { ContentProvider } from '@agentg/framework/cp';

export const controlPlaneContentProvider = {
  contents: [
    {
      contentId: 'events.stream.panel',
      load: () => import('../events/eventStreamContent.vue'),
      tags: ['control-plane.events']
    }
  ],
  domainId: 'control-plane'
} satisfies ContentProvider;
