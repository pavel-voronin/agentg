import type { ContentProvider } from '@agentg/control-plane-sdk/slots';

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
