import type { ControlPlaneProviderRegistration } from '@agentg/control-plane-sdk/manifest';

const providerStyleAssets = ['assets/style.css'];

export const historyControlPlane = {
  contents: [
    {
      contentId: 'history.dashboard.targets',
      defaultSlotIds: ['control-plane.dashboard.tile.2'],
      module: {
        assetPath: 'dashboard-tile.js'
      },
      props: {
        metric: 'targets'
      },
      styleAssetPaths: providerStyleAssets,
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'history.dashboard.coverage',
      defaultSlotIds: ['control-plane.dashboard.tile.3'],
      module: {
        assetPath: 'dashboard-tile.js'
      },
      props: {
        metric: 'coverage'
      },
      styleAssetPaths: providerStyleAssets,
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'history.dashboard.current-job',
      defaultSlotIds: ['control-plane.dashboard.tile.4'],
      module: {
        assetPath: 'dashboard-tile.js'
      },
      props: {
        metric: 'currentJob'
      },
      styleAssetPaths: providerStyleAssets,
      tags: ['control-plane.dashboard.tile']
    },
    {
      contentId: 'history.workspace',
      defaultSlotIds: ['telegram.workspace.primary'],
      module: {
        assetPath: 'workspace.js'
      },
      styleAssetPaths: providerStyleAssets,
      tags: ['telegram.workspace.content']
    }
  ]
} satisfies ControlPlaneProviderRegistration;
