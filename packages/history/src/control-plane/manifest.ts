import type { ControlPlaneProviderRegistration } from '@agentg/control-plane-sdk/manifest';

const providerStyleAssets = ['assets/style.css'];

export function createHistoryControlPlane(
  assetVersion: string,
  assetVersions: Readonly<Record<string, string>>
): ControlPlaneProviderRegistration {
  return {
    assetVersion,
    assetVersions,
    contents: [
      {
        contentId: 'history.dashboard.current-job',
        defaultSlotIds: ['control-plane.dashboard.tile.4'],
        module: {
          assetPath: 'dashboard-tile.js'
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
  };
}
