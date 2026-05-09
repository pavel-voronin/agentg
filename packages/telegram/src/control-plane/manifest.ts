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
        module: {
          assetPath: 'dashboard-chats.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.dashboard.tile']
      },
      {
        contentId: 'telegram.dashboard.file-queue',
        module: {
          assetPath: 'dashboard-file-queue.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.dashboard.tile']
      },
      {
        contentId: 'telegram.chat.messages',
        metadata: {
          tab: {
            label: 'Messages',
            order: 10
          }
        },
        module: {
          assetPath: 'chat-messages.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['telegram.workspace']
      },
      {
        contentId: 'telegram.workspace',
        module: {
          assetPath: 'workspace.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.workspace']
      },
      {
        contentId: 'telegram.status.tdlib',
        module: {
          assetPath: 'status.js'
        },
        styleAssetPaths: providerStyleAssets,
        tags: ['control-plane.header.status']
      }
    ]
  };
}
