import type { ContentProvider } from '@agentg/control-plane-sdk/slots';

export const historyControlPlaneProvider = {
  contents: [
    {
      contentId: 'history.dashboard.targets',
      defaultSlotIds: ['control-plane.dashboard.tile.2'],
      load: () => import('./HistoryDashboardTileContent.vue'),
      props: {
        metric: 'targets'
      },
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'history.dashboard.coverage',
      defaultSlotIds: ['control-plane.dashboard.tile.3'],
      load: () => import('./HistoryDashboardTileContent.vue'),
      props: {
        metric: 'coverage'
      },
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'history.dashboard.current-job',
      defaultSlotIds: ['control-plane.dashboard.tile.4'],
      load: () => import('./HistoryDashboardTileContent.vue'),
      props: {
        metric: 'currentJob'
      },
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'history.workspace',
      defaultSlotIds: ['telegram.workspace.primary'],
      load: () => import('./HistoryWorkspaceContent.vue'),
      tags: ['telegram.workspace.content']
    }
  ],
  domainId: 'history'
} satisfies ContentProvider;
