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
  },
  {
    contentId: 'data.telegramChat.relatedData',
    load: () => import('./frontend/telegramChatDataContent.vue'),
    metadata: {
      tab: {
        label: 'Data',
        order: 30,
        routeSegment: 'data'
      }
    },
    tags: ['telegram.client']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const dashboard = {
  contents,
  title: 'Data'
} as const;

export default dashboard;
