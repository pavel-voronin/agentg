import type { ContentDefinition } from '@agentg/framework/dashboard';

const contents = [
  {
    contentId: 'history-sync.client',
    load: () => import('./frontend/clientContent.vue'),
    metadata: {
      tab: {
        label: 'History Coverage',
        order: 20,
        routeSegment: 'history'
      }
    },
    tags: ['telegram.client']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const dashboard = {
  contents,
  title: 'History Sync'
} as const;

export default dashboard;
