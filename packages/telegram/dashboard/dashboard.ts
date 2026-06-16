import type { ContentDefinition } from '@agentg/framework/dashboard';

const contents = [
  {
    contentId: 'telegram.client.page',
    load: () => import('./frontend/clientContent.vue'),
    metadata: {
      page: {
        icon: 'solar:chat-square-code-bold',
        label: 'Client',
        order: 5,
        routeSegment: 'client'
      }
    },
    tags: ['dashboard.page']
  },
  {
    contentId: 'telegram.chat.messages',
    load: () => import('./frontend/chatMessagesContent.vue'),
    metadata: {
      tab: {
        label: 'Messages',
        order: 10
      }
    },
    tags: ['telegram.client']
  },
  {
    contentId: 'telegram.chat.historyCoverage',
    load: () => import('./frontend/historyCoverageContent.vue'),
    metadata: {
      tab: {
        label: 'History Coverage',
        order: 20,
        routeSegment: 'history'
      }
    },
    tags: ['telegram.client']
  },
  {
    contentId: 'telegram.status.tdlib',
    load: () => import('./frontend/statusContent.vue'),
    tags: ['dashboard.header.status']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const dashboard = {
  contents,
  title: 'Telegram'
} as const;

export default dashboard;
