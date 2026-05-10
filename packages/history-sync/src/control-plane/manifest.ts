import type { ControlPlaneProviderRegistration } from '@agentg/control-plane-sdk/manifest';

const providerStyleAssets = ['assets/style.css'];

export function createHistorySyncControlPlane(
  assetVersion: string,
  assetVersions: Readonly<Record<string, string>>
): ControlPlaneProviderRegistration {
  return {
    assetVersion,
    assetVersions,
    contents: [
      {
        contentId: 'history-sync.dashboard.coverage-updates',
        module: {
          assetPath: 'dashboard-tile.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.dashboard.tile']
      },
      {
        contentId: 'history-sync.workspace',
        metadata: {
          tab: {
            label: 'History Sync Coverage',
            order: 20
          }
        },
        module: {
          assetPath: 'workspace.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['telegram.workspace']
      }
    ]
  };
}
