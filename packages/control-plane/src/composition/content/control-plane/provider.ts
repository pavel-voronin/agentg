import type { ContentProvider } from '@agentg/control-plane-extension/slots';

export const controlPlaneContentProvider = {
  contents: [
    {
      contentId: 'control-plane.dashboard.metrics',
      load: () => import('./DashboardMetricsContent.vue'),
      tags: ['control-plane.dashboard']
    },
    {
      contentId: 'events.stream.panel',
      load: () => import('../events/EventStreamContent.vue'),
      tags: ['control-plane.events', 'telegram.workspace.content']
    }
  ],
  domainId: 'control-plane'
} satisfies ContentProvider;
