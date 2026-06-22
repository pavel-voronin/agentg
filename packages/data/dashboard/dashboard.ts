import type { ContentDefinition } from '@agentg/framework/dashboard';

const contents = [
  {
    contentId: 'data.page',
    load: () => import('./frontend/dataPage.vue'),
    metadata: {
      page: {
        icon: 'solar:database-bold',
        label: 'Data',
        order: 8,
        routeSegment: 'data'
      }
    },
    tags: ['dashboard.page']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const dashboard = {
  contents,
  title: 'Data'
} as const;

export default dashboard;
