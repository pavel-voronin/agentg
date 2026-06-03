import type { ContentDefinition } from '@agentg/framework/cp';

const contents = [
  {
    contentId: 'history-sync.dashboard.coverage-updates',
    load: () => import('./frontend/dashboardTileContent.vue'),
    tags: ['control-plane.dashboard.tile']
  },
  {
    contentId: 'history-sync.workspace',
    load: () => import('./frontend/workspaceContent.vue'),
    metadata: {
      tab: {
        label: 'History Coverage',
        order: 20
      }
    },
    tags: ['telegram.workspace']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const controlPlane = {
  contents,
  title: 'History Sync'
} as const;

export default controlPlane;
