import type { ControlPlaneContentProvider } from '@agentg/shared/control-plane/slot-content';

export const historySyncControlPlaneProvider = {
  contents: [
    {
      contentId: 'history.workspace',
      load: () => import('./HistoryWorkspaceContent.vue'),
      tags: ['control-plane.workspace', 'telegram.workspace.content']
    }
  ],
  domainId: 'history'
} satisfies ControlPlaneContentProvider;
