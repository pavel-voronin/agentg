import type { ControlPlaneContentProvider } from '@agentg/shared/control-plane/slot-content';

export const telegramControlPlaneProvider = {
  contents: [
    {
      contentId: 'telegram.workspace',
      load: () => import('./TelegramWorkspaceContent.vue'),
      tags: ['control-plane.workspace']
    }
  ],
  domainId: 'telegram'
} satisfies ControlPlaneContentProvider;
