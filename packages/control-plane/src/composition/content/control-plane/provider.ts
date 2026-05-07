import type { ContentProvider } from '@agentg/control-plane-sdk/slots';

export const controlPlaneContentProvider = {
  contents: [
    {
      contentId: 'events.stream.panel',
      defaultSlotIds: ['control-plane.events.preview'],
      load: () => import('../events/EventStreamContent.vue'),
      tags: ['control-plane.events']
    }
  ],
  domainId: 'control-plane'
} satisfies ContentProvider;
