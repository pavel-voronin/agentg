import type { ContentDefinition } from '@agentg/framework/cp';

const contents = [
  {
    contentId: 'telegram.dashboard.chats',
    load: () => import('./frontend/dashboardChatsContent.vue'),
    tags: ['control-plane.dashboard.tile']
  },
  {
    contentId: 'telegram.dashboard.file-queue',
    load: () => import('./frontend/fileQueueContent.vue'),
    tags: ['control-plane.dashboard.tile']
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
    contentId: 'telegram.client',
    load: () => import('./frontend/clientContent.vue'),
    tags: ['control-plane.client']
  },
  {
    contentId: 'telegram.telemetry.ingestion-queue',
    load: () => import('./frontend/telemetry/ingestionQueueTab.vue'),
    metadata: {
      telemetryTab: {
        label: 'Ingestion',
        order: 80,
        statusSource: {
          eventType: 'telegram.ingestion-queue',
          label: 'Ingestion queue',
          sourceId: 'telegram.ingestion.queue',
          timeline: [
            { durationMs: 3_000, label: 'Live', tone: 'ok' },
            { durationMs: 5_000, label: 'Queued', tone: 'warn' },
            { durationMs: 30_000, label: 'Stale', tone: 'neutral' }
          ]
        },
        subtitle: 'Telegram update queue',
        tabId: 'ingestion'
      }
    },
    tags: ['telemetry.page.tab', 'telemetry.page.tab.ingestion']
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
