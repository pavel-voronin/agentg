import type { ContentDefinition } from '@agentg/framework/cp';

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
    tags: ['control-plane.page']
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
    contentId: 'telegram.status.tdlib',
    load: () => import('./frontend/statusContent.vue'),
    tags: ['control-plane.header.status']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const controlPlane = {
  contents,
  title: 'Telegram'
} as const;

export default controlPlane;
