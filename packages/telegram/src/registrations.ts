import { telegramRpcSurface } from './rpc/surface.js';
import { telegramControlPlane } from './control-plane/manifest.js';

export function createTelegramServiceManifest(config: { rpcUrl: string }) {
  return {
    controlPlane: telegramControlPlane,
    events: [
      'telegram.chat.removed',
      'telegram.chat.updated',
      'telegram.chat_folders.updated',
      'telegram.login.completed',
      'telegram.message.created',
      'telegram.message.deleted',
      'telegram.message.updated',
      'telegram.status',
      'telegram.tdlib.*',
      'telegram.user.updated'
    ],
    extensions: [],
    procedures: telegramRpcSurface.procedures(),
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'telegram'
  };
}
