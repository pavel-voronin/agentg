import type { ControlPlaneProviderRegistration } from '@agentg/control-plane-sdk/manifest';

const providerStyleAssets = ['assets/style.css'];

export function createTelegramControlPlane(
  assetVersion: string,
  assetVersions: Readonly<Record<string, string>>
): ControlPlaneProviderRegistration {
  return {
    assetVersion,
    assetVersions,
    contents: [
      {
        contentId: 'telegram.dashboard.chats',
        defaultSlotIds: ['control-plane.dashboard.tile.1'],
        module: {
          assetPath: 'dashboard-chats.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.dashboard.tile']
      },
      {
        contentId: 'telegram.workspace',
        defaultSlotIds: ['control-plane.workspace'],
        module: {
          assetPath: 'workspace.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.workspace']
      },
      {
        contentId: 'telegram.status.tdlib',
        defaultSlotIds: ['control-plane.header.status'],
        module: {
          assetPath: 'status.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.header.status']
      }
    ],
    defaultPlacements: [
      {
        contentId: 'events.stream.panel',
        slotId: 'telegram.workspace.sidecar'
      }
    ]
  };
}
