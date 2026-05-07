import type { ContentProvider } from '@agentg/control-plane-sdk/slots';

export const telegramControlPlaneProvider = {
  contents: [
    {
      contentId: 'telegram.dashboard.chats',
      defaultSlotIds: ['control-plane.dashboard.tile.1'],
      load: () => import('./TelegramDashboardChatsContent.vue'),
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'telegram.workspace',
      defaultSlotIds: ['control-plane.workspace'],
      load: () => import('./TelegramWorkspaceContent.vue'),
      tags: ['control-plane.workspace']
    },
    {
      contentId: 'telegram.status.tdlib',
      defaultSlotIds: ['control-plane.header.status'],
      load: () => import('./TelegramStatusContent.vue'),
      tags: ['control-plane.header.status']
    }
  ],
  defaultPlacements: [
    {
      contentId: 'events.stream.panel',
      slotId: 'telegram.workspace.sidecar'
    }
  ],
  domainId: 'telegram'
} satisfies ContentProvider;
